import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { JoinWaitlistRequest, WaitlistEntry, WaitlistOffer } from '../models/bipsy.models';
import { AcceptOfferRequest, WaitlistOfferDetail } from '../models/confirm.models';

/**
 * Lista de espera del cliente: apuntarse a un servicio sin hueco y responder a
 * los avisos que llegan cuando se libera uno. Port de `WaitlistRepository`
 * (solo el lado cliente; el del negocio vive en la app de negocio).
 */
@Injectable({ providedIn: 'root' })
export class WaitlistRepository {
  private readonly api = inject(ApiService);

  join(req: JoinWaitlistRequest): Promise<WaitlistEntry> {
    return this.api.post<WaitlistEntry>('/waitlist', req);
  }

  mine(): Promise<WaitlistEntry[]> {
    return this.api.get<WaitlistEntry[]>('/waitlist/me');
  }

  leave(entryId: number): Promise<void> {
    return this.api.delete<void>(`/waitlist/${entryId}`);
  }

  /** Avisos de hueco libre pendientes de contestar. */
  myOffers(): Promise<WaitlistOffer[]> {
    return this.api.get<WaitlistOffer[]>('/waitlist/offers/me');
  }

  /**
   * Acepta el hueco: crea la cita, ya confirmada.
   *
   * `acceptedPolicy` solo se exige cuando el negocio cobra por cancelar. Si
   * falta, el servidor responde 400 y **el aviso sigue vivo**: se puede
   * reintentar marcándola. Si alguien se quedó el hueco antes responde 409 —
   * el hueco nunca se bloquea mientras dura el aviso.
   */
  acceptOffer(offerId: number, acceptedPolicy = false): Promise<WaitlistOffer> {
    return this.api.post<WaitlistOffer>(`/waitlist/offers/${offerId}/accept`, { acceptedPolicy });
  }

  /** Un aviso concreto. Es lo que abre el enlace de la notificación o del correo. */
  offer(offerId: number): Promise<WaitlistOfferDetail> {
    return this.api.get<WaitlistOfferDetail>(`/waitlist/offers/${offerId}`);
  }

  /**
   * Acepta el hueco con todo lo que puede pedir: política y, si el servicio es
   * a domicilio, a dónde ir.
   *
   * Aparte de `acceptOffer` para no cambiar su firma. La dirección se pide AL
   * ACEPTAR y no al apuntarse: una guardada hace semanas lleva todo ese tiempo
   * caducando. Si falta cuando hace falta, 400 con el aviso intacto.
   */
  acceptOfferWith(offerId: number, req: AcceptOfferRequest): Promise<WaitlistOfferDetail> {
    return this.api.post<WaitlistOfferDetail>(`/waitlist/offers/${offerId}/accept`, req);
  }

  /** Rechazar cierra la espera entera y pasa el turno al siguiente. */
  declineOffer(offerId: number): Promise<void> {
    return this.api.post<void>(`/waitlist/offers/${offerId}/decline`, {});
  }
}
