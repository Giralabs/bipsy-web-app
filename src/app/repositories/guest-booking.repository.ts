import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  CreateGuestBookingRequest,
  GuestBookingResponse,
  GuestCardSetup,
  GuestRequestResponse,
  PrepareGuestCardRequest,
} from '../models/bipsy.models';

/**
 * Reservar y gestionar una cita SIN cuenta.
 *
 * Todo con `auth: false`, y no es solo que no haga falta token: mandarlo sería
 * un problema. Con uno caducado en el navegador, la petición daría 401 y el
 * cliente acabaría en el login en mitad de una reserva que no necesitaba
 * ninguna cuenta. Es lo mismo que ya hace `CatalogRepository`.
 *
 * Lo que identifica al cliente después de reservar es el `token` de su cita. Es
 * un portador: sirve para ESA cita y nada más, no abre sesión y no dice quién
 * es. Vive en el enlace de su correo y en la URL de `/cita/:token`.
 */
@Injectable({ providedIn: 'root' })
export class GuestBookingRepository {
  private readonly api = inject(ApiService);

  /**
   * Pide la cita. **No la crea**: manda un correo con un enlace, y la cita nace
   * al confirmarlo.
   *
   * Si el negocio pide tarjeta, `cardToken` y `paymentMethodId` son
   * obligatorios y salen de `prepareCard`: el servidor responde 402 sin ellos.
   */
  requestBooking(req: CreateGuestBookingRequest): Promise<GuestRequestResponse> {
    return this.api.post<GuestRequestResponse>('/public/bookings', req, false);
  }

  /**
   * La solicitud que hay detrás del enlace del correo.
   *
   * Puede dar 409 aunque el enlace sea bueno: el hueco **no está reservado**
   * mientras no confirme, así que otra persona puede haberlo cogido. La página
   * lo dice antes de ofrecer el botón.
   */
  requestByToken(token: string): Promise<GuestRequestResponse> {
    return this.api.get<GuestRequestResponse>(
      `/public/bookings/solicitudes/${encodeURIComponent(token)}`, undefined, false);
  }

  /** Confirma la solicitud: aquí nace la cita, con su propio token. */
  confirmRequest(token: string): Promise<GuestBookingResponse> {
    return this.api.post<GuestBookingResponse>(
      `/public/bookings/solicitudes/${encodeURIComponent(token)}/confirmar`, {}, false);
  }

  /**
   * Primer paso cuando el negocio pide tarjeta: el secreto con el que Stripe.js
   * la confirma, y el token que hay que devolver al reservar.
   *
   * Va antes de crear la cita a propósito. Si fuera después, quien no termina
   * de poner la tarjeta le dejaría al negocio una cita sin la garantía con la
   * que la habría aceptado.
   */
  prepareCard(req: PrepareGuestCardRequest): Promise<GuestCardSetup> {
    return this.api.post<GuestCardSetup>('/public/bookings/tarjeta', req, false);
  }

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
