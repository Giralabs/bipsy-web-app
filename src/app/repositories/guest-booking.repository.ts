import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { GuestBookingResponse } from '../models/bipsy.models';

/**
 * La cita que el NEGOCIO le dio a alguien sin cuenta, por el token de su correo.
 *
 * ⚠️ Reservar sin cuenta no existe: la reserva desde la web exige entrar. Esto
 * es lo otro —la cita que el negocio teclea en su agenda para quien no se baja
 * apps (V107)— y el token es lo único que identifica a esa persona: sirve para
 * ESA cita, no abre sesión y no dice quién es.
 *
 * Con `auth: false`, y no es solo que no haga falta token: mandarlo sería un
 * problema. Con uno caducado en el navegador la petición daría 401 y echaría al
 * login a quien no tiene cuenta ninguna. Es lo mismo que hace `CatalogRepository`.
 */
@Injectable({ providedIn: 'root' })
export class GuestBookingRepository {
  private readonly api = inject(ApiService);

  /** Su cita, por el token del enlace. 404 si el enlace no vale. */
  byToken(token: string): Promise<GuestBookingResponse> {
    return this.api.get<GuestBookingResponse>(`/citas/${encodeURIComponent(token)}`, undefined, false);
  }

  /** Dice que sí va. Es un acuse: su cita vale igual sin esto. */
  confirm(token: string): Promise<GuestBookingResponse> {
    return this.api.post<GuestBookingResponse>(
      `/citas/${encodeURIComponent(token)}/confirmar`, {}, false);
  }

  /**
   * Dice que no puede ir.
   *
   * POST y no GET, y no es un detalle de estilo: Gmail y Outlook **pre-cargan**
   * los enlaces de un correo, así que un GET cancelaría la cita sin que nadie
   * la tocara. La respuesta trae `feeChargedCents`, que es lo que hay que
   * decirle en el acto si cancela tarde.
   */
  cancel(token: string): Promise<GuestBookingResponse> {
    return this.api.post<GuestBookingResponse>(
      `/citas/${encodeURIComponent(token)}/cancelar`, {}, false);
  }
}
