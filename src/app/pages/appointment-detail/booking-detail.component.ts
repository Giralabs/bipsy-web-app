import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BookingRepository } from '../../repositories/booking.repository';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { ChatRepository } from '../../repositories/chat.repository';
import {
  BookingResponse,
  BusinessResponse,
  CancellationFee,
  ReviewResponse,
  businessLocationDisplay,
  isBookingActive,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { BookingStatusPillComponent } from '../../components/status-pill/booking-status-pill.component';
import { capitalize, longDate, parseLocal, time } from '../../shared/dates';
import { businessPath } from '../../shared/slug';
import { euros } from '../../shared/dates';

/**
 * Detalle de una cita. Port de `BookingDetailScreen`.
 *
 * Las tres acciones —reseñar, cambiar de día y cancelar— y, debajo, la letra
 * pequeña de lo que cuesta echarse atrás. **El importe se pide al servidor
 * antes de preguntar**: el aviso tiene que decir la cifra exacta, no "puede
 * que se te cobre algo", y el botón la lleva puesta — enterarse al pulsar de
 * que cancelar cuesta dinero es enterarse tarde.
 */
@Component({
  selector: 'app-booking-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, BookingStatusPillComponent],
  templateUrl: './booking-detail.component.html',
  styleUrl: './booking-detail.component.css',
})
export class BookingDetailComponent implements OnInit {
  private readonly bookings = inject(BookingRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  booking?: BookingResponse;
  business?: BusinessResponse;
  fee: CancellationFee | null = null;
  myReview: ReviewResponse | null = null;

  isLoading = true;
  loadError: ApiError | null = null;
  busy = false;
  actionError: string | null = null;

  // Hoja de reseña
  reviewOpen = false;
  reviewRating = 5;
  reviewComment = '';

  async ngOnInit(): Promise<void> {
    if (!this.session.isAuthenticated && !this.session.tokenLooksPresent) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    await this.load();
  }

  async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.isLoading = true;
    this.loadError = null;
    try {
      this.booking = await this.bookings.byId(id);
    } catch (raw) {
      this.loadError = ApiError.from(raw);
      this.isLoading = false;
      return;
    }
    this.isLoading = false;

    // Ni el negocio, ni la tarifa, ni la reseña pueden tumbar la pantalla: lo
    // que se viene a ver —cuándo y con quién— ya está.
    const [business, review] = await Promise.allSettled([
      this.catalog.business(this.booking.businessId),
      this.bookings.myReviews(),
    ]);
    if (business.status === 'fulfilled') {
      this.business = business.value;
    }
    if (review.status === 'fulfilled') {
      this.myReview = review.value.find(r => r.bookingId === this.booking!.id) ?? null;
    }

    // Solo se pregunta por la tarifa si la cita aún se puede cancelar: para
    // una pasada la respuesta siempre es cero y sería una llamada de más.
    if (this.canCancel) {
      try {
        this.fee = await this.bookings.cancellationFee(this.booking.id);
      } catch {
        this.fee = null;
      }
    }
  }

  // ----- VISTA --------------------

  get dateLabel(): string {
    return this.booking ? capitalize(longDate(parseLocal(this.booking.startDateTime))) : '';
  }

  get timeRange(): string {
    if (!this.booking) {
      return '';
    }
    return `${time(parseLocal(this.booking.startDateTime))} — ${time(parseLocal(this.booking.endDateTime))}`;
  }

  get isFuture(): boolean {
    return !!this.booking && parseLocal(this.booking.startDateTime).getTime() > Date.now();
  }

  get canCancel(): boolean {
    return !!this.booking && this.isFuture && isBookingActive(this.booking);
  }

  get canReview(): boolean {
    return !!this.booking?.canReview && !this.myReview;
  }

  get willCharge(): boolean {
    return !!this.fee?.willCharge;
  }

  get feeAmount(): string {
    return euros((this.fee?.amountCents ?? 0) / 100);
  }

  get cancelLabel(): string {
    return this.willCharge ? `Cancelar y pagar ${this.feeAmount}` : 'Cancelar cita';
  }

  get locationDisplay(): string {
    return this.business ? businessLocationDisplay(this.business) : '';
  }

  stars(count: number): number[] {
    return [1, 2, 3, 4, 5].map(i => (i <= count ? 1 : 0));
  }

  // ----- ACCIONES --------------------

  goBack(): void {
    this.location.back();
  }

  /**
   * Escribir al negocio. Va ENCIMA de las acciones sobre la cita: es lo que se
   * busca cuando algo no encaja con ella, y es lo que evita que la
   * conversación se vaya a WhatsApp.
   */
  async openChat(): Promise<void> {
    if (!this.booking || this.busy) {
      return;
    }
    this.busy = true;
    this.actionError = null;
    try {
      const conversation = await this.chat.openWithBusiness(this.booking.businessId);
      this.router.navigate(['/mensajes', conversation.id]);
    } catch (raw) {
      this.actionError = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  reschedule(): void {
    this.router.navigate(['/appointments', this.booking!.id, 'cambiar']);
  }

  openBusiness(): void {
    this.router.navigate(businessPath({
      id: this.booking!.businessId,
      name: this.business?.name ?? this.booking!.businessName,
    }));
  }

  async cancel(): Promise<void> {
    if (!this.booking || this.busy) {
      return;
    }
    const message = this.willCharge
      ? `Quedan menos de ${this.fee!.windowHours} h para tu cita de "${this.booking.serviceName}", ` +
        `así que cancelar ahora tiene un coste de ${this.feeAmount} (${this.fee!.feePercent} % del ` +
        'servicio). Se cargará en tu tarjeta guardada.\n\n¿Quieres cancelarla igualmente?'
      : `¿Seguro que quieres cancelar tu cita de "${this.booking.serviceName}"? ` +
        'Esta acción no se puede deshacer.';

    if (!confirm(message)) {
      return;
    }

    this.busy = true;
    this.actionError = null;
    try {
      this.booking = await this.bookings.cancel(this.booking.id);
      this.fee = null;
    } catch (raw) {
      const error = ApiError.from(raw);
      this.actionError = error.isConflict
        ? 'Esta cita ya no se puede cancelar.'
        : 'No se ha podido cancelar. Inténtalo de nuevo.';
    } finally {
      this.busy = false;
    }
  }

  // ----- RESEÑA --------------------

  openReview(): void {
    this.reviewOpen = true;
    this.reviewRating = 5;
    this.reviewComment = '';
    this.actionError = null;
  }

  async submitReview(): Promise<void> {
    if (!this.booking || this.busy) {
      return;
    }
    this.busy = true;
    this.actionError = null;
    try {
      this.myReview = await this.bookings.createReview({
        bookingId: this.booking.id,
        rating: this.reviewRating,
        comment: this.reviewComment.trim() || undefined,
      });
      this.reviewOpen = false;
    } catch (raw) {
      this.actionError = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  async deleteReview(): Promise<void> {
    if (!this.myReview || this.busy) {
      return;
    }
    if (!confirm('¿Eliminamos tu reseña? El negocio dejará de verla.')) {
      return;
    }
    this.busy = true;
    try {
      await this.bookings.deleteReview(this.myReview.id);
      this.myReview = null;
    } catch (raw) {
      this.actionError = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }
}
