import { Component, DestroyRef, HostListener, OnInit, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SessionService } from '../../core/session.service';
import { PaymentRepository } from '../../repositories/payment.repository';
import { BookingQuote, PendingPaymentRequest, quoteUsable } from '../../models/payments-extras.models';
import { PayBookingSheetComponent } from '../pay-booking-sheet/pay-booking-sheet.component';
import { PaymentRequestGateService } from './payment-request-gate.service';

/**
 * Cada cuánto se vuelve a preguntar con la pestaña a la vista.
 *
 * La app no sondea: pregunta al abrirse, al volver a primer plano y cuando
 * llega la push del cobro. La web no recibe esa push con la pestaña abierta
 * —no hay manejador de mensajes en primer plano—, así que este sondeo hace
 * su papel. Medio minuto porque la ventana del negocio dura minutos y el
 * cliente suele estar delante del mostrador; con la pestaña oculta se para,
 * y al volver a ella se pregunta en el acto (el «resumed» de la app).
 */
const POLL_MS = 30_000;

/**
 * La ventana de pago que salta sola cuando el negocio pide el cobro. Port de
 * `PaymentRequestGate` (payment_request_gate.dart).
 *
 * **Por qué existe.** El negocio termina la cita y pide el pago con el cliente
 * delante. El aviso se pierde por motivos normales —sin permisos, sin mirar—
 * y el negocio se queda esperando de pie sin saber por qué. Así que la web
 * pregunta, y si hay una petición en pie abre la hoja de pago sin que el
 * cliente haya navegado a ningún sitio.
 *
 * Es de lo poco que interrumpe al usuario, y el criterio se cumple por los dos
 * lados: caduca en minutos y perderla tiene consecuencia —el negocio se queda
 * sin cobrar—.
 *
 * Se monta UNA vez en la raíz; no pinta nada mientras no haya petición.
 */
@Component({
  selector: 'app-payment-request-gate',
  standalone: true,
  imports: [PayBookingSheetComponent],
  template: `
    @if (sheet; as s) {
      <app-pay-booking-sheet
        [quote]="s.quote"
        [concept]="s.request.concept"
        [pedidoPor]="s.request.businessName"
        [expiresAt]="s.request.expiresAt"
        (closed)="onClosed($event)"
      ></app-pay-booking-sheet>
    }
  `,
})
export class PaymentRequestGateComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly payments = inject(PaymentRepository);
  private readonly gate = inject(PaymentRequestGateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Lo que pinta la hoja: la petición y su presupuesto. */
  sheet: { request: PendingPaymentRequest; quote: BookingQuote } | null = null;

  private signedIn = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    // Una petición nueva: se pide su presupuesto y se abre la hoja.
    effect(() => {
      const req = this.gate.open();
      untracked(() => {
        if (req) {
          void this.prepare(req);
        } else {
          this.sheet = null;
        }
      });
    });
  }

  ngOnInit(): void {
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
      if (status === 'unknown') return;
      const wasSignedIn = this.signedIn;
      this.signedIn = status === 'authenticated';
      if (this.signedIn && !wasSignedIn) {
        // Al entrar: es justo cuando más probable es que haya una esperando.
        void this.gate.check();
        this.startPolling();
      } else if (!this.signedIn) {
        this.stopPolling();
        this.gate.reset();
      }
    });
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  /** Volver a la pestaña es el «volver a la app» del móvil. */
  @HostListener('document:visibilitychange')
  onVisibility(): void {
    if (!this.signedIn) return;
    if (document.visibilityState === 'visible') {
      void this.gate.check();
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this.timer = setInterval(() => void this.gate.check(), POLL_MS);
  }

  private stopPolling(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * El presupuesto y no el importe de la petición: es lo que necesita la hoja
   * —la clave de Stripe, la cuenta del negocio, si hay tarjeta— y además es la
   * cifra EN VIGOR, por si pagó una parte desde otro sitio entre medias.
   */
  private async prepare(request: PendingPaymentRequest): Promise<void> {
    try {
      const quote = await this.payments.bookingQuote(request.bookingId);
      if (!quoteUsable(quote) || quote.dueCents <= 0) {
        // Nada que cobrar por aquí: en silencio, como cualquier fallo de esto.
        this.gate.settle(false);
        return;
      }
      this.sheet = { request, quote };
    } catch {
      this.gate.settle(false);
    }
  }

  onClosed(paid: boolean): void {
    this.sheet = null;
    this.gate.settle(paid);
  }
}
