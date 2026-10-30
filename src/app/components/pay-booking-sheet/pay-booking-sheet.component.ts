import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Stripe, StripeError } from '@stripe/stripe-js';
import { ApiError } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';
import { PaymentRepository } from '../../repositories/payment.repository';
import { PaymentMethodResponse, cardLabel } from '../../models/bipsy.models';
import {
  BookingQuote,
  cardExpiry,
  cents,
  defaultCard,
  paymentDone,
  paymentNeedsAction,
} from '../../models/payments-extras.models';
import { ButtonComponent } from '../button/button.component';
import { AddCardSheetComponent } from '../add-card-sheet/add-card-sheet.component';

/**
 * `tarjeta` es un PASO de esta hoja y no otra hoja encima: dos velos apilados
 * oscurecen el fondo el doble y el importe se pierde de vista. Igual que en la
 * app, mientras se añade la tarjeta solo se ve esa hoja, y al guardar se vuelve
 * aquí con el importe en su sitio.
 */
type Phase = 'review' | 'tarjeta' | 'processing';

/** Por debajo de esto el plazo se pinta en ámbar. La ventana entera son minutos. */
const URGENT_MS = 3 * 60_000;

/**
 * Paga la cita. Port de `showPayBookingSheet` (pay_booking_sheet.dart).
 *
 * Hermana de la hoja de cobro de la tarifa (`app-booking-charge-sheet`) pero
 * no de la misma naturaleza: allí se cobra una penalización como efecto de
 * cancelar y el cliente solo mira; aquí el cobro es lo único que ha pedido.
 *
 * **Cómo se cobra.** Igual que la app con tarjeta guardada:
 *   1. `POST /payments/booking/{id}` con NUESTRO id de tarjeta. Casi siempre el
 *      cobro queda hecho ahí mismo.
 *   2. Si el banco pide 3-D Secure, vuelve un `clientSecret` y Stripe.js abre
 *      el reto con `handleNextAction`, **apuntando a la cuenta Connect del
 *      negocio** (`stripeAccount`): el cobro vive allí y desde la de Bipsy no
 *      se encuentra.
 *   3. Se vuelve a hacer el mismo POST. El servidor encuentra el cobro a medias
 *      y le pregunta a Stripe cómo quedó; preguntar al presupuesto diría «sin
 *      pagar» hasta que llegara el webhook.
 *
 * En la app el `stripeAccountId` es estado GLOBAL del SDK y hay que soltarlo
 * al salir. Aquí no: cada `loadStripe` devuelve su propia instancia, así que la
 * de la cuenta del negocio vive y muere con esta hoja y la de guardar tarjetas
 * sigue apuntando a Bipsy sin que nadie tenga que acordarse.
 *
 * `retiene` cambia lo que se dice, no lo que se hace: con la cita por aceptar
 * el importe se RESERVA en la tarjeta y llamarlo «pagar» le haría buscar un
 * cargo que su banco no le va a enseñar.
 *
 * `pedidoPor` y `expiresAt` son el caso del negocio que PIDE el cobro al
 * terminar la cita, y van juntos: sin quién cobra sería una petición de dinero
 * anónima, y sin el plazo no sabría que tiene prisa.
 *
 * `closed` emite `true` si el dinero llegó a salir (o a reservarse).
 */
@Component({
  selector: 'app-pay-booking-sheet',
  standalone: true,
  imports: [CommonModule, ButtonComponent, AddCardSheetComponent],
  templateUrl: './pay-booking-sheet.component.html',
  styleUrl: './pay-booking-sheet.component.css',
})
export class PayBookingSheetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly payments = inject(PaymentRepository);
  private readonly toasts = inject(ToastService);

  @Input({ required: true }) quote!: BookingQuote;
  @Input({ required: true }) concept = '';
  /** El importe se reserva en la tarjeta en vez de cobrarse. */
  @Input() retiene = false;
  /** El negocio que pide el cobro, cuando lo pide él. */
  @Input() pedidoPor: string | null = null;
  /** Cuándo se cierra su ventana de cobro (`Instant` en UTC). */
  @Input() expiresAt: string | null = null;

  @Output() closed = new EventEmitter<boolean>();

  @ViewChild('box') private box?: ElementRef<HTMLElement>;
  @ViewChild('title') private titleEl?: ElementRef<HTMLElement>;
  @ViewChild(AddCardSheetComponent) private cardSheet?: AddCardSheetComponent;

  phase: Phase = 'review';
  error: string | null = null;

  /** Las tarjetas guardadas. Null mientras se piden. */
  methods: PaymentMethodResponse[] | null = null;
  methodsLoading = true;

  /** Clave de la cuenta de Bipsy, para guardar una tarjeta desde aquí. */
  platformKey: string | null = null;

  /**
   * Se acabó el plazo del negocio con la hoja abierta.
   *
   * No se cierra la hoja al llegar a cero: con alguien mirándola, que
   * desaparezca de golpe se lee como que la web se ha caído. Se apaga el botón
   * y se dice lo que ha pasado —el servidor ya rechazaría el cobro—.
   */
  caducado = false;
  remainingMs = 0;
  private ticker?: ReturnType<typeof setInterval>;

  /** Donde estaba el foco al abrirse, para devolverlo al cerrar. */
  private returnFocus: HTMLElement | null = null;

  ngOnInit(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    void this.loadMethods();
    if (this.expiresAt) {
      this.tick();
      this.ticker = setInterval(() => this.tick(), 1000);
    }
  }

  ngAfterViewInit(): void {
    // Al título y no al botón de pagar: un Intro despistado no puede cobrar.
    setTimeout(() => this.titleEl?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    clearInterval(this.ticker);
    this.returnFocus?.focus?.();
  }

  // ----- VISTA --------------------

  get amount(): string {
    return cents(this.quote.dueCents);
  }

  get paidLabel(): string | null {
    return this.quote.paidCents > 0 ? `Ya has pagado ${cents(this.quote.paidCents)}` : null;
  }

  get subtitle(): string {
    // Quién lo pide va DELANTE cuando lo pide él: la hoja ha saltado sin que
    // navegara a ningún sitio, y lo primero es reconocer de quién es el cobro.
    return this.pedidoPor ? `${this.pedidoPor} · ${this.concept}` : this.concept;
  }

  get card(): PaymentMethodResponse | null {
    return this.methods ? defaultCard(this.methods) : null;
  }

  /**
   * Si hay tarjeta AHORA MISMO. Sale de la lista y no del presupuesto: el
   * presupuesto es de cuando se abrió la hoja, y aquí dentro se puede añadir.
   */
  get hasCard(): boolean {
    return this.methods ? this.methods.length > 0 : this.quote.hasSavedCard;
  }

  cardText(method: PaymentMethodResponse): string {
    return cardLabel(method);
  }

  cardExp(method: PaymentMethodResponse): string {
    return cardExpiry(method);
  }

  get payLabel(): string {
    if (this.caducado) return 'Se ha pasado el plazo';
    if (!this.hasCard) return 'Añade una tarjeta para pagar';
    return this.retiene ? `Reservar ${this.amount} en mi tarjeta` : `Pagar ${this.amount} con mi tarjeta`;
  }

  get countdownLabel(): string {
    if (this.caducado) return 'Se ha pasado el plazo';
    return this.remainingMs < 60_000
      ? 'Menos de un minuto'
      : `Quedan ${Math.floor(this.remainingMs / 60_000)} min`;
  }

  /**
   * Ámbar solo en los últimos minutos: la ventana entera son minutos, así que
   * con un umbral mayor estaría siempre encendido, y un color siempre puesto
   * no avisa de nada.
   */
  get urgent(): boolean {
    return !this.caducado && this.remainingMs < URGENT_MS;
  }

  private tick(): void {
    if (!this.expiresAt) return;
    this.remainingMs = Math.max(0, new Date(this.expiresAt).getTime() - Date.now());
    if (this.remainingMs === 0) {
      this.caducado = true;
      clearInterval(this.ticker);
    }
  }

  // ----- TARJETAS --------------------

  private async loadMethods(): Promise<void> {
    try {
      this.methods = await this.payments.methods();
    } catch {
      // Sin la lista se confía en el presupuesto: como mucho el botón llevará
      // a añadir una tarjeta que ya existía, que es mejor que no dejar pagar.
      this.methods = null;
    } finally {
      this.methodsLoading = false;
    }
  }

  /**
   * Añadir la tarjeta sin salir de aquí, y seguir donde se estaba. Sin esto el
   * botón decía «Añade una tarjeta» y no llevaba a ninguna parte: cerrar, ir a
   * Pagos, guardarla y esperar que la petición del negocio siguiera viva.
   */
  async addCard(): Promise<void> {
    this.error = null;
    if (!this.platformKey) {
      try {
        const config = await this.payments.config();
        this.platformKey = config.enabled ? (config.publishableKey ?? null) : null;
      } catch {
        this.platformKey = null;
      }
    }
    if (!this.platformKey) {
      this.error = 'Los pagos no están disponibles ahora mismo.';
      return;
    }
    this.phase = 'tarjeta';
    // Se pinta primero y se prepara después: `open()` necesita su hueco en el
    // DOM para montar el formulario de Stripe.
    setTimeout(async () => {
      // `eventCoalescing` (app.config) deja la detección de cambios del clic
      // para el siguiente fotograma, y este setTimeout llega antes: el `@if`
      // aún no había pintado la hoja, `cardSheet` era undefined y salía «No
      // hemos podido abrir la pasarela de pago». Se pinta aquí, a la fuerza.
      this.cdr.detectChanges();
      const ok = await this.cardSheet?.open();
      if (!ok) {
        this.error = this.cardSheet?.error ?? 'No hemos podido abrir la pasarela de pago.';
        this.backToReview();
      }
    });
  }

  onCardSaved(method: PaymentMethodResponse): void {
    // La recién guardada pasa a ser la que se usa: es la que acaba de elegir.
    const rest = (this.methods ?? []).filter(m => m.id !== method.id).map(m => ({ ...m, isDefault: false }));
    this.methods = [{ ...method, isDefault: true }, ...rest];
    this.backToReview();
  }

  backToReview(): void {
    this.phase = 'review';
    setTimeout(() => this.titleEl?.nativeElement.focus());
  }

  // ----- PAGAR --------------------

  onPrimary(): void {
    if (this.caducado || this.phase !== 'review') return;
    if (!this.hasCard) {
      void this.addCard();
      return;
    }
    void this.pay();
  }

  private async pay(): Promise<void> {
    this.phase = 'processing';
    this.error = null;
    const q = this.quote;
    try {
      const methods = this.methods?.length ? this.methods : await this.payments.methods();
      const card = defaultCard(methods);
      if (!card) {
        throw new PayError('No tienes ninguna tarjeta guardada.');
      }

      const res = await this.payments.payBooking(q.bookingId, card.id);
      if (paymentDone(res)) {
        this.finish();
        return;
      }
      if (!paymentNeedsAction(res)) {
        throw new PayError(res.failureReason || 'No se ha podido procesar el pago.');
      }

      // Falta el reto del banco. En la cuenta del negocio, no en la de Bipsy.
      const stripe = await this.stripeFor(q.publishableKey ?? '', res.stripeAccountId || q.stripeAccountId || '');
      const { error } = await stripe.handleNextAction({ clientSecret: res.clientSecret! });
      if (error) {
        throw new PayError(stripeMessage(error));
      }

      // Volver del reto no basta: se vuelve a pedir el pago y el servidor le
      // pregunta a STRIPE cómo quedó, sin esperar al webhook.
      const confirmed = await this.payments.payBooking(q.bookingId, card.id);
      if (!paymentDone(confirmed)) {
        throw new PayError(confirmed.failureReason || 'El pago no se ha completado.');
      }
      this.finish();
    } catch (raw) {
      this.phase = 'review';
      this.error = raw instanceof PayError ? raw.message : ApiError.from(raw).message;
    }
  }

  /** Stripe.js apuntando a la cuenta Connect del negocio. */
  private async stripeFor(publishableKey: string, stripeAccount: string): Promise<Stripe> {
    if (!publishableKey || !stripeAccount) {
      throw new PayError('Este negocio no tiene los pagos activos ahora mismo.');
    }
    const { loadStripe } = await import('@stripe/stripe-js');
    // `locale: 'es'`: los mensajes del reto y sus errores, en español.
    const stripe = await loadStripe(publishableKey, { stripeAccount, locale: 'es' });
    if (!stripe) {
      throw new PayError('No hemos podido cargar la pasarela de pago.');
    }
    return stripe;
  }

  private finish(): void {
    this.toasts.success(this.retiene ? 'Importe reservado en tu tarjeta.' : 'Pago realizado.');
    this.closed.emit(true);
  }

  // ----- CERRAR --------------------

  /** «Ahora no», el velo o Escape. Un cobro en marcha no se interrumpe. */
  dismiss(): void {
    if (this.phase === 'processing') return;
    this.closed.emit(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      // En el paso de la tarjeta, Escape vuelve al importe y no cierra todo.
      if (this.phase === 'tarjeta') {
        this.backToReview();
      } else {
        this.dismiss();
      }
      return;
    }
    // El tabulador da vueltas dentro de la hoja.
    if (event.key === 'Tab' && this.phase !== 'tarjeta' && this.box) {
      const items = Array.from(
        this.box.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}

/** Un fallo con el texto ya escrito para el cliente. */
class PayError extends Error {}

/**
 * Lo que dice Stripe, en cristiano. Con `locale: 'es'` su mensaje ya viene en
 * español; los códigos de aquí son los que más salen y merecen una frase
 * nuestra que diga qué hacer.
 */
function stripeMessage(error: StripeError): string {
  switch (error.code) {
    case 'payment_intent_authentication_failure':
      return 'Tu banco no ha confirmado el pago. Vuelve a intentarlo y completa la verificación.';
    case 'card_declined':
      return error.decline_code === 'insufficient_funds'
        ? 'La tarjeta no tiene saldo suficiente.'
        : 'Tu banco ha rechazado el pago. Prueba con otra tarjeta.';
    case 'expired_card':
      return 'La tarjeta ha caducado. Añade otra para pagar.';
    default:
      return error.message || 'No se ha podido completar el pago.';
  }
}
