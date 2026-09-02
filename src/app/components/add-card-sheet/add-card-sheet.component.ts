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
  imports: [CommonModule, ButtonComponent],
  templateUrl: './add-card-sheet.component.html',
  styleUrl: './add-card-sheet.component.css',
})
export class AddCardSheetComponent implements AfterViewChecked, OnDestroy {
  private readonly payments = inject(PaymentRepository);

  /** Clave publicable de Stripe. Sin ella la hoja no se puede abrir. */
  @Input({ required: true }) publishableKey: string | null = null;

  /** Texto bajo el título. Cada sitio explica por qué se pide la tarjeta. */
  @Input() reason: string | null = null;

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
    this.busy = true;
    this.error = null;
    this.mounted = false;
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(this.publishableKey);
      if (!this.stripe) {
        this.error = 'No hemos podido cargar la pasarela de pago.';
        return false;
      }
      const clientSecret = await this.payments.createSetupIntent();
      this.elements = this.stripe.elements({ clientSecret, appearance: { theme: 'night' } });
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

      this.saved.emit(await this.payments.registerMethod(paymentMethodId));
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.ready = false;
    this.mounted = false;
    this.elements = null;
    this.closed.emit();
  }
}
