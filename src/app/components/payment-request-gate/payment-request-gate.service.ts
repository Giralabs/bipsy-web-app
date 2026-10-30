import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { PaymentRepository } from '../../repositories/payment.repository';
import { PendingPaymentRequest } from '../../models/payments-extras.models';
import { SessionService } from '../../core/session.service';

/**
 * La petición de cobro que el cliente tiene en pie. Port de
 * `pendingPaymentRequestProvider` y `shownPaymentRequestsProvider`.
 *
 * Vive aparte del componente para que cualquier pantalla pueda pedir que se
 * vuelva a mirar (`check()`) o enterarse de que se ha pagado una (`paid$`): la
 * ficha de la cita, por ejemplo, tiene que dejar de ofrecer «Pagar» si el pago
 * entró por la ventana que saltó encima.
 */
@Injectable({ providedIn: 'root' })
export class PaymentRequestGateService {
  private readonly payments = inject(PaymentRepository);
  private readonly session = inject(SessionService);

  /** La petición a enseñar ahora mismo. La pinta `<app-payment-request-gate>`. */
  readonly open = signal<PendingPaymentRequest | null>(null);

  /**
   * La petición viva, se haya enseñado ya o no. La lee la tarjeta de Mis citas
   * (`PaymentRequestSummary` en la app): la ventana salta una sola vez, y si se
   * cerró con «Ahora no» la tarjeta es lo que queda mientras corra el plazo.
   */
  readonly live = signal<PendingPaymentRequest | null>(null);

  /** Id de la cita que se acaba de pagar desde la ventana. */
  readonly paid$ = new Subject<number>();

  /**
   * Las peticiones ya enseñadas, para no repetirlas.
   *
   * **Una vez por petición.** Si la cierra con «Ahora no» ya se enteró, y
   * volver a saltarle cada vez que mira la pestaña sería una web que no deja
   * usarse. En memoria y no en disco a propósito: una petición vive minutos,
   * así que entre dos visitas ya ha caducado.
   */
  private readonly shown = new Set<number>();

  /** Para no pedir dos veces a la vez si coinciden el sondeo y la vuelta a la pestaña. */
  private checking = false;

  /**
   * Pregunta si hay petición y, si es nueva y sigue viva, la abre.
   *
   * Los fallos se tragan: esto no lo ha pedido nadie, le salta. Un cartel de
   * error sobre una pantalla que él no abrió no le dice qué hacer, y el negocio
   * tiene al lado otras formas de cobrar.
   */
  async check(): Promise<void> {
    // Sin sesión no hay a quién pedirle nada: Mis citas lo llamaba igual y
    // dejaba un 401 en la consola. El componente vuelve a mirar al entrar.
    if (!this.session.isAuthenticated) return;
    if (this.checking || this.open()) return;
    this.checking = true;
    try {
      const req = await this.payments.pendingRequest();
      // Caducada mientras llegaba: ni ventana ni tarjeta.
      const alive = req && new Date(req.expiresAt).getTime() > Date.now() ? req : null;
      this.live.set(alive);
      if (!alive) return;
      if (this.shown.has(alive.id)) return;
      // Se marca ANTES de abrir: si se marcara al cerrar, un sondeo que llegara
      // con la hoja abierta la volvería a abrir en cuanto se cerrase.
      this.shown.add(alive.id);
      this.open.set(alive);
    } catch {
      // Ver arriba: en silencio.
    } finally {
      this.checking = false;
    }
  }

  /** Lo llama la ventana al cerrarse. */
  settle(paid: boolean): void {
    const req = this.open();
    this.open.set(null);
    if (paid && req) {
      this.live.set(null);
      this.paid$.next(req.bookingId);
    }
  }

  /** La tarjeta de Mis citas: abre la ventana a petición, aunque ya se enseñara. */
  reopen(req: PendingPaymentRequest): void {
    this.open.set(req);
  }

  /** Al cerrar sesión: lo enseñado era de otra cuenta. */
  reset(): void {
    this.shown.clear();
    this.open.set(null);
    this.live.set(null);
  }
}
