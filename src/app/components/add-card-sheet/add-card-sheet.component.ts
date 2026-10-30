import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../core/api-error';
import { PaymentRepository } from '../../repositories/payment.repository';
import { PaymentMethodResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';

/**
 * Hoja para guardar una tarjeta. Port de `AddCardSheet` de la app.
 *
 * Vive suelta y no dentro de Pagos porque hacen falta dos: en Ajustes › Pagos y
 * **en medio de una reserva**, cuando el negocio exige tarjeta y la cuenta no
 * tiene ninguna. Mandar al usuario a su perfil a mitad de reservar es perder la
 * cita: al volver ha perdido el hueco que tenía elegido.
 *
 * El SDK de Stripe se carga al abrir, no antes: pesa, y la mayoría de las
 * reservas no pasan por aquí.
 */
@Component({
  selector: 'app-add-card-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './add-card-sheet.component.html',
  styleUrl: './add-card-sheet.component.css',
})
export class AddCardSheetComponent implements AfterViewChecked, OnDestroy {
  private readonly payments = inject(PaymentRepository);

  /** Clave publicable de Stripe. Sin ella la hoja no se puede abrir. */
  @Input({ required: true }) publishableKey: string | null = null;

  /** Texto bajo el título. Cada sitio explica por qué se pide la tarjeta. */
  @Input() reason: string | null = null;

  /**
   * Si el cliente quiere dejarla guardada para próximas reservas.
   *
   * **Empieza sin marcar a propósito**: guardar la tarjeta de alguien es una
   * decisión, no lo que pasa si no haces nada.
   *
   * ⚠️ Sin marcar NO significa que se borre al salir. La tarjeta es la garantía
   * con la que el negocio acepta la cita, así que sigue vinculada mientras
   * alguna cita pueda generar un cargo —cancelar tarde, no presentarse— y la
   * retira después `PaymentMethodCleanupScheduler`. Lo que decide esta casilla
   * es si se queda **más allá de eso**.
   */
  keepSaved = false;

  /**
   * Si se ofrece la casilla de «guardar para próximas reservas». En false la
   * tarjeta se guarda sin preguntar: es el caso de la hoja de pago, donde se
   * está pagando y «solo para esta cita» no significa nada.
   */
  @Input() canDecline = true;

  @Output() saved = new EventEmitter<PaymentMethodResponse>();

  @Output() closed = new EventEmitter<void>();

  @ViewChild('cardHost') cardHost?: ElementRef<HTMLElement>;

  /** Abriendo (cargando SDK e intent) o guardando. Ambos bloquean. */
  busy = false;
  ready = false;
  error: string | null = null;

  private stripe: import('@stripe/stripe-js').Stripe | null = null;
  private elements: import('@stripe/stripe-js').StripeElements | null = null;
  private mounted = false;
  /** La tarjeta que Stripe ya ha confirmado en esta apertura. */
  private confirmedMethodId: string | null = null;
  /** Para descartar una apertura que se cerró antes de terminar de cargar. */
  private openSeq = 0;

  /** El Element solo se puede montar cuando su hueco existe en el DOM. */
  ngAfterViewChecked(): void {
    if (this.ready && this.cardHost && !this.mounted && this.elements) {
      // Sin Link ni monederos: aquí no se está pagando, se está guardando una
      // tarjeta para un cargo que puede no llegar a existir. El banner de
      // «regístrate en Link» convierte un paso de un campo en una decisión
      // sobre una cuenta de un tercero, y Apple Pay y Google Pay no sirven
      // para lo que hace falta —una tarjeta que se pueda cobrar sin el
      // titular delante—.
      this.elements
        .create('payment', {
          wallets: { link: 'never', applePay: 'never', googlePay: 'never' },
        })
        .mount(this.cardHost.nativeElement);
      this.mounted = true;
    }
  }

  ngOnDestroy(): void {
    this.elements = null;
    this.stripe = null;
  }

  /**
   * Prepara la pasarela. Quien monte la hoja tiene que llamarlo al abrirla.
   *
   * Devuelve `false` si no se ha podido preparar, para que quien llama no deje
   * una hoja vacía en pantalla.
   */
  async open(): Promise<boolean> {
    if (!this.publishableKey) {
      this.error = 'La pasarela de pago no está disponible ahora mismo.';
      return false;
    }
    const seq = ++this.openSeq;
    this.busy = true;
    this.error = null;
    this.mounted = false;
    this.confirmedMethodId = null;
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(this.publishableKey);
      if (!this.stripe) {
        this.error = 'No hemos podido cargar la pasarela de pago.';
        return false;
      }
      const clientSecret = await this.payments.createSetupIntent();
      // Cerrada mientras cargaba: sin esto se marcaba lista y el formulario
      // se montaba en una hoja que ya no estaba abierta.
      if (seq !== this.openSeq) return false;
      // El tema del formulario sigue al de la web, que va con el del sistema.
      // Con 'night' fijo, en modo claro salía un bloque negro en una hoja
      // blanca. Se lee al abrir: cambiar de tema con la hoja abierta es raro y
      // rehacer el Element a medio escribir perdería lo tecleado.
      const light = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
      this.elements = this.stripe.elements({
        clientSecret,
        locale: 'es',
        appearance: { theme: light ? 'stripe' : 'night' },
      });
      this.ready = true;
      return true;
    } catch (raw) {
      this.error = ApiError.from(raw).message;
      return false;
    } finally {
      this.busy = false;
    }
  }

  async submit(): Promise<void> {
    if (!this.stripe || !this.elements || this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    try {
      // Ya confirmada y lo que falló fue guardarla en nuestro servidor: se
      // reintenta solo eso. Volver a confirmar un SetupIntent que ya ha
      // salido bien lo rechaza Stripe, y la hoja quedaba atascada.
      if (this.confirmedMethodId) {
        this.saved.emit(await this.payments.registerMethod(this.confirmedMethodId, this.keepSaved || !this.canDecline));
        return;
      }
      // `redirect: 'if_required'` deja el 3-D Secure en un modal cuando el
      // banco lo pide y evita salir de la página cuando no hace falta. La
      // autenticación fuerte se resuelve AQUÍ, con el titular delante: si se
      // dejara para el cobro, la tarifa se quedaría sin cobrar.
      const { error, setupIntent } = await this.stripe.confirmSetup({
        elements: this.elements,
        redirect: 'if_required',
      });

      if (error) {
        this.error = error.message ?? 'No hemos podido guardar la tarjeta.';
        return;
      }
      const paymentMethodId = typeof setupIntent?.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id;
      if (!paymentMethodId) {
        this.error = 'La pasarela no ha devuelto la tarjeta. Inténtalo de nuevo.';
        return;
      }
      this.confirmedMethodId = paymentMethodId;

      this.saved.emit(await this.payments.registerMethod(paymentMethodId, this.keepSaved || !this.canDecline));
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.openSeq++;
    this.ready = false;
    this.mounted = false;
    this.elements = null;
    this.closed.emit();
  }
}
