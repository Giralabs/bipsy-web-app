import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BookingRepository } from '../repositories/booking.repository';
import { BookingResponse } from '../models/bipsy.models';
import { isAwaitingCustomer } from '../models/confirm.models';
import { SessionService } from './session.service';

/**
 * Flujos a medias de los que no se saca a nadie: en la app la confirmación se
 * apila encima y al cerrarla se sigue donde se estaba; aquí navegar perdería
 * lo elegido. Se abrirá la próxima vez que vuelva a la pestaña.
 */
const BUSY_FLOW = /\/(reservar|cambiar|confirmar)$|^\/lista-espera\//;

/** Lo justo para ordenar por plazo. */
type Awaiting = Pick<BookingResponse, 'id' | 'status'> & { confirmExpiresAt?: string | null };

/**
 * Las citas que esperan respuesta del cliente y siguen en plazo, de la más
 * cercana a caducar a la que más le queda. Port de `awaitingConfirm`.
 */
export function awaitingConfirm<T extends Awaiting>(list: T[], now = Date.now()): T[] {
  return list
    .filter(b => isAwaitingCustomer(b) && !!b.confirmExpiresAt && Date.parse(b.confirmExpiresAt) > now)
    .sort((a, b) => Date.parse(a.confirmExpiresAt!) - Date.parse(b.confirmExpiresAt!));
}

/**
 * La pantalla de confirmar que se abre sola cuando el negocio te ha dado cita.
 * Port de `ConfirmRequestGate` (app, 06/11/2026).
 *
 * **Por qué no basta el aviso.** La cita caduca en diez minutos y el aviso se
 * pierde por motivos normales —sin permiso de notificaciones, sin tocarlo—.
 * Así que la web pregunta al entrar y cada vez que se vuelve a la pestaña, y
 * si hay una cita esperando su respuesta abre `/citas/:id/confirmar`.
 *
 * Solo al ENTRAR: si se sale sin contestar no se reabre hasta la próxima vez
 * que se vuelva a la pestaña (si volviera a mirar al salir, la misma cita se
 * abriría sin fin). Y no se abre si ya está delante.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmRequestGateService {
  private readonly bookings = inject(BookingRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  private started = false;
  private signedIn = false;
  private checking = false;

  private readonly onVisibility = () => {
    if (this.signedIn && document.visibilityState === 'visible') void this.check();
  };

  /** Lo arranca la raíz una sola vez. */
  start(destroyRef: DestroyRef): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;
    const sub = this.session.status$.subscribe(status => {
      if (status === 'unknown') return;
      const was = this.signedIn;
      this.signedIn = status === 'authenticated';
      // Al entrar: es justo cuando más probable es que haya una esperando.
      if (this.signedIn && !was) void this.check();
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    destroyRef.onDestroy(() => {
      sub.unsubscribe();
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  /** Los fallos se tragan: esto no lo ha pedido nadie. Se vuelve a mirar luego. */
  async check(): Promise<void> {
    if (!this.session.isAuthenticated || this.checking) return;
    this.checking = true;
    try {
      const [next] = awaitingConfirm(await this.bookings.mine());
      if (!next) return;
      const target = `/citas/${next.id}/confirmar`;
      const here = this.router.url.split('?')[0];
      if (here === target || BUSY_FLOW.test(here)) return;
      await this.router.navigateByUrl(target);
    } catch {
      // Sin red o un 500: en silencio.
    } finally {
      this.checking = false;
    }
  }
}
