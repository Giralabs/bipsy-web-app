import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { BreakpointService } from '../../core/breakpoint.service';
import { DialogService } from '../../core/dialog.service';
import { SessionService } from '../../core/session.service';
import { BookingRepository } from '../../repositories/booking.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { BookingToConfirm, isAwaitingCustomer } from '../../models/confirm.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { DeadlineCountdownComponent } from '../../components/deadline-countdown/deadline-countdown.component';
import { capitalize, euros, longDate, parseLocal, time } from '../../shared/dates';

/** Por qué la cita ya no espera respuesta, dicho para quien lo lee. */
interface Resolved {
  title: string;
  message: string;
}

/**
 * La cita que te ha puesto el negocio: aceptarla o rechazarla. Port de
 * `BookingConfirmScreen`.
 *
 * Es el espejo del aviso de hueco de la lista de espera, y por el mismo motivo
 * lo enseña TODO de una vez: qué cita es, cuánto queda para contestar, lo que
 * cuesta y lo que se acepta al quedársela. Con diez minutos corriendo,
 * cualquier cosa que obligue a salir de aquí es una cita perdida.
 *
 * A diferencia del hueco de la lista de espera, aquí el hueco SÍ está
 * reservado: el negocio lo bloqueó al dar la cita. Lo que corre no es el
 * riesgo de que otro lo coja, es el plazo.
 */
@Component({
  selector: 'app-booking-confirm',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    AddCardSheetComponent,
    DeadlineCountdownComponent,
  ],
  templateUrl: './booking-confirm.component.html',
  styleUrls: ['./confirm-shell.css', './booking-confirm.component.css'],
})
export class BookingConfirmComponent implements OnInit {
  /** Los datos van en la lista (móvil) o en la tarjeta lateral (escritorio). */
  readonly desktop = inject(BreakpointService).desktop;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly bookings = inject(BookingRepository);
  private readonly payments = inject(PaymentRepository);
  private readonly dialog = inject(DialogService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;

  booking?: BookingToConfirm;
  isLoading = true;
  loadError: ApiError | null = null;

  acceptedPolicy = false;
  sending = false;
  error: string | null = null;

  /** La acabas de confirmar aquí: se dice con otras palabras que si ya lo estaba. */
  justConfirmed = false;

  // ----- TARJETA --------------------
  //
  // Si el negocio pide tarjeta y no hay ninguna guardada, el botón cambia:
  // primero la tarjeta y confirmar después. El servidor responde 402 sin ella,
  // así que ofrecer «Confirmar cita» sería un botón que falla al pulsarlo.
  /** null mientras no se sabe: entonces se deja el botón normal. */
  hasCard: boolean | null = null;
  stripeKey: string | null = null;
  cardSheetOpen = false;

  private get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    if (!this.session.isAuthenticated && !this.session.tokenLooksPresent) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      this.booking = await this.bookings.toConfirm(this.id);
    } catch (raw) {
      this.loadError = ApiError.from(raw);
      return;
    } finally {
      this.isLoading = false;
    }
    if (this.isOpen && this.booking.requiresCard) {
      void this.checkCard();
    }
  }

  // ----- VISTA --------------------

  /**
   * Se puede contestar todavía: espera respuesta y el plazo no ha vencido.
   *
   * El plazo se mira aquí también y no solo el estado: el servidor cierra las
   * caducadas con un proceso que pasa cada poco, y entre medias la cita sigue
   * diciendo que espera. Enseñar botones que van a responder 409 es peor.
   */
  get isOpen(): boolean {
    const b = this.booking;
    if (!b || !isAwaitingCustomer(b) || !b.confirmExpiresAt) {
      return false;
    }
    return new Date(b.confirmExpiresAt).getTime() > Date.now();
  }

  /**
   * La cita ya no espera respuesta: se aceptó, se rechazó o caducó.
   *
   * Se distingue el motivo porque no son lo mismo para quien lo lee: que se
   * haya pasado el plazo no es lo mismo que haberla rechazado, y decir «ya no
   * está disponible» a secas deja pensando que la web ha fallado.
   */
  get resolved(): Resolved {
    const b = this.booking!;
    switch (b.status) {
      case 'CONFIRMED':
        return {
          title: this.justConfirmed ? 'Cita confirmada. ¡Te esperan!' : 'Cita confirmada',
          message: `Ya está en tus citas. Te esperan el ${this.whenShort}.`,
        };
      case 'CANCELED':
        return {
          title: 'Esta cita ya no está',
          // No se distingue «la rechacé yo» de «se me pasó el plazo» a
          // propósito: el motivo lo escribe el servidor, y decirlo con sus
          // palabras evita que la web invente una historia distinta.
          message: b.cancelReason?.trim()
            || 'Se canceló. Habla con el negocio si todavía te interesa.',
        };
      case 'AWAITING_CUSTOMER':
        // Vencida pero aún sin cerrar en el servidor.
        return {
          title: 'Se pasó el plazo',
          message: 'La cita se cancelará sola. Habla con el negocio si todavía te interesa.',
        };
      default:
        return {
          title: 'Esta cita ya no espera tu respuesta',
          message: 'Puedes verla en Mis citas.',
        };
    }
  }

  get canOpenBooking(): boolean {
    return this.booking?.status === 'CONFIRMED';
  }

  get businessLabel(): string {
    return this.booking?.businessName || 'Negocio';
  }

  /** «Miércoles, 3 de septiembre a las 10:30». */
  get whenLabel(): string {
    if (!this.booking) return '';
    const start = parseLocal(this.booking.startDateTime);
    return `${capitalize(longDate(start))} a las ${time(start)}`;
  }

  private get whenShort(): string {
    if (!this.booking) return '';
    const start = parseLocal(this.booking.startDateTime);
    const day = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(start);
    return `${day} a las ${time(start)}`;
  }

  get priceLabel(): string | null {
    // Misma regla que `bookingPrice`: `priceCents` manda y `price` queda por
    // compatibilidad. Escrita aquí porque aquella espera el tipo de la lista.
    const b = this.booking;
    if (!b) return null;
    if (typeof b.priceCents === 'number') return euros(b.priceCents / 100);
    return typeof b.price === 'number' ? euros(b.price) : null;
  }

  get needsPolicy(): boolean {
    return !!this.booking?.requiresPolicyConsent && !!this.booking.policyText;
  }

  get needsCard(): boolean {
    return !!this.booking?.requiresCard && this.hasCard === false;
  }

  /** Con la tarjeta pendiente el botón sí se puede pulsar: lleva a ponerla. */
  get canAccept(): boolean {
    if (this.sending) return false;
    if (this.needsCard) return true;
    return !this.booking?.requiresPolicyConsent || this.acceptedPolicy;
  }

  // ----- ACCIONES --------------------

  goBack(): void {
    this.location.back();
  }

  goToBookings(): void {
    this.router.navigate(['/citas']);
  }

  openBooking(): void {
    this.router.navigate(['/citas', this.id]);
  }

  /**
   * Se acabó el plazo con la pantalla abierta: se recarga para que salga la
   * versión cerrada en vez de dejar botones que ya no van a funcionar.
   */
  onExpired(): void {
    void this.load();
  }

  confirmOrAddCard(): void {
    if (this.needsCard) {
      void this.openCardSheet();
      return;
    }
    void this.accept();
  }

  async accept(): Promise<void> {
    if (!this.booking || this.sending) return;
    this.sending = true;
    this.error = null;
    try {
      this.booking = await this.bookings.customerConfirm(this.booking.id, this.acceptedPolicy);
      this.justConfirmed = true;
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isConflict) {
        // El 409 no es un error que haya que esconder: se pasó el plazo o la
        // cita cambió. Se recarga y la pantalla lo cuenta ella.
        await this.load();
        return;
      }
      if (error.isPaymentRequired) {
        // Se corrige el estado para que el botón ofrezca guardarla en vez de
        // repetir el mismo error.
        this.hasCard = false;
        void this.checkCard();
      }
      this.error = error.message || 'No se ha podido confirmar la cita.';
    } finally {
      this.sending = false;
    }
  }

  async decline(): Promise<void> {
    if (!this.booking || this.sending) return;
    const ok = await this.dialog.confirm({
      title: '¿Rechazar esta cita?',
      message: 'El negocio se enterará y el hueco volverá a quedar libre. No se te cobra nada por rechazarla.',
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!ok) return;

    this.sending = true;
    this.error = null;
    try {
      await this.bookings.customerDecline(this.booking.id);
      // Se recarga en vez de salir: así se ve con las palabras del servidor
      // que la cita ya no está, y desde un enlace de correo no hay a dónde
      // «volver».
      await this.load();
    } catch (raw) {
      this.error = ApiError.from(raw).message || 'No se ha podido rechazar.';
    } finally {
      this.sending = false;
    }
  }

  // ----- TARJETA --------------------

  /**
   * ¿Hay tarjeta guardada? Si la consulta falla se deja en null y el botón
   * normal: el servidor rechaza igual sin tarjeta, así que no se cuela nada, y
   * el 402 ya cambia el botón.
   */
  private async checkCard(): Promise<void> {
    try {
      const [config, methods] = await Promise.all([
        this.payments.config(),
        this.payments.methods(),
      ]);
      this.stripeKey = config.publishableKey ?? null;
      this.hasCard = methods.length > 0;
    } catch {
      this.hasCard = null;
    }
  }

  /**
   * Pone la tarjeta sin salir de aquí. Mandar a Pagos con el plazo corriendo
   * es la cita perdida: es la misma decisión que en el flujo de reserva.
   */
  async openCardSheet(): Promise<void> {
    if (!this.stripeKey) {
      this.error = 'La pasarela de pago no está disponible ahora mismo. Inténtalo en un momento.';
      return;
    }
    this.error = null;
    this.cardSheetOpen = true;
    // La hoja se pinta primero y se prepara después: `open()` necesita que su
    // hueco exista para montar el formulario de Stripe.
    setTimeout(async () => {
      // `eventCoalescing` (app.config) deja la detección de cambios del clic
      // para el siguiente fotograma, y este setTimeout llega antes: el `@if`
      // aún no había pintado la hoja, `cardSheet` era undefined y salía «No
      // hemos podido abrir la pasarela de pago». Se pinta aquí, a la fuerza.
      this.cdr.detectChanges();
      const ok = await this.cardSheet?.open();
      if (!ok) {
        this.cardSheetOpen = false;
        this.error = this.cardSheet?.error ?? 'No hemos podido abrir la pasarela de pago.';
      }
    });
  }

  /**
   * Tarjeta guardada. Si no queda nada más por marcar se confirma sin otro
   * toque; si falta la política, se deja que la acepte primero.
   */
  onCardSaved(): void {
    this.cardSheetOpen = false;
    this.hasCard = true;
    if (!this.booking?.requiresPolicyConsent || this.acceptedPolicy) {
      void this.accept();
    }
  }

  onCardSheetClosed(): void {
    this.cardSheetOpen = false;
  }
}
