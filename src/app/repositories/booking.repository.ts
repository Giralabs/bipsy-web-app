import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  BookingResponse,
  CancellationFee,
  CreateBookingRequest,
  CreateReviewRequest,
  PageResponse,
  RescheduleBookingRequest,
  ReviewResponse,
} from '../models/bipsy.models';
import { BookingToConfirm, CustomerConfirmRequest } from '../models/confirm.models';

/** Citas del cliente: crear, listar, cambiar de hora, cancelar y valorar. */
@Injectable({ providedIn: 'root' })
export class BookingRepository {
  private readonly api = inject(ApiService);

  create(req: CreateBookingRequest): Promise<BookingResponse> {
    return this.api.post<BookingResponse>('/bookings', req);
  }

  /** La ruta del cliente es `/bookings/me/customer`. */
  async mine(): Promise<BookingResponse[]> {
    const res = await this.api.get<BookingResponse[] | PageResponse<BookingResponse>>(
      '/bookings/me/customer',
    );
    return Array.isArray(res) ? res : (res?.content ?? []);
  }

  byId(id: number): Promise<BookingResponse> {
    return this.api.get<BookingResponse>(`/bookings/${id}`);
  }

  cancel(id: number, reason?: string): Promise<BookingResponse> {
    return this.api.put<BookingResponse>(`/bookings/${id}/cancel`, reason ? { reason } : {});
  }

  /**
   * Cambiar de hora repite la validación completa de disponibilidad —es una
   * reserva nueva en todo salvo en el id— y se penaliza igual que cancelar,
   * calculando sobre la hora original.
   */
  reschedule(id: number, req: RescheduleBookingRequest): Promise<BookingResponse> {
    return this.api.put<BookingResponse>(`/bookings/${id}/reschedule`, req);
  }

  /** Lo que costaría cancelar ahora mismo. Se consulta ANTES de preguntar. */
  cancellationFee(id: number): Promise<CancellationFee> {
    return this.api.get<CancellationFee>(`/bookings/${id}/cancellation-fee`);
  }

  // ----- CITAS QUE PONE EL NEGOCIO --------------------

  /**
   * La misma cita que `byId`, leída con los campos de confirmación (plazo,
   * tarjeta, política). Es el mismo endpoint: solo cambia lo que se mira.
   */
  toConfirm(id: number): Promise<BookingToConfirm> {
    return this.api.get<BookingToConfirm>(`/bookings/${id}`);
  }

  /**
   * Acepta una cita que puso el negocio.
   *
   * `acceptedPolicy` solo hace falta cuando la cita trae
   * `requiresPolicyConsent`. Puede responder 409 si el plazo ya terminó y 402
   * si hace falta tarjeta y no hay ninguna: las dos son respuestas normales de
   * esa pantalla, no fallos que haya que esconder.
   */
  customerConfirm(id: number, acceptedPolicy = false): Promise<BookingToConfirm> {
    const body: CustomerConfirmRequest = { acceptedPolicy };
    return this.api.put<BookingToConfirm>(`/bookings/${id}/customer-confirm`, body);
  }

  /**
   * Rechaza una cita que puso el negocio. **No cuesta penalización**, al
   * contrario que `cancel`: por eso es un endpoint propio. Responde 204.
   */
  customerDecline(id: number): Promise<void> {
    return this.api.put<void>(`/bookings/${id}/customer-decline`, {});
  }

  // ----- RESEÑAS --------------------

  createReview(req: CreateReviewRequest): Promise<ReviewResponse> {
    return this.api.post<ReviewResponse>('/reviews', req);
  }

  /** Las del cliente. Una página grande: nadie escribe cientos de reseñas. */
  async myReviews(size = 100): Promise<ReviewResponse[]> {
    const res = await this.api.get<ReviewResponse[] | PageResponse<ReviewResponse>>('/reviews/me', { page: 0, size });
    return Array.isArray(res) ? res : (res?.content ?? []);
  }

  updateReview(id: number, rating: number, comment?: string): Promise<ReviewResponse> {
    return this.api.put<ReviewResponse>(`/reviews/${id}`, { rating, comment });
  }

  /** El negocio puede responder una reseña, pero solo su autor la borra. */
  deleteReview(id: number): Promise<void> {
    return this.api.delete<void>(`/reviews/${id}`);
  }
}
