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

  // ----- RESEÑAS --------------------

  createReview(req: CreateReviewRequest): Promise<ReviewResponse> {
    return this.api.post<ReviewResponse>('/reviews', req);
  }

  async myReviews(): Promise<ReviewResponse[]> {
    const res = await this.api.get<ReviewResponse[] | PageResponse<ReviewResponse>>('/reviews/me');
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
