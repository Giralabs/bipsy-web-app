import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BookingRepository } from '../../repositories/booking.repository';
import { BookingResponse, ReviewResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { SegmentedComponent } from '../../components/segmented/segmented.component';
import { fixImageUrl } from '../../shared/image-url';
import { longDate, parseLocal } from '../../shared/dates';
import { businessPath } from '../../shared/slug';

/** Límite de `GipsiInputLimits.reviewComment` en la app. */
const COMMENT_MAX = 500;

/**
 * Reseñas. Port de `MyReviewsScreen`.
 *
 * Dos pestañas: **Pendientes** —citas ya terminadas que todavía no has
 * valorado, una por negocio y la más reciente— y **Tus reseñas**, con la
 * respuesta del negocio si la hay.
 */
@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent, SegmentedComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class ReviewsComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly bookings = inject(BookingRepository);
  private readonly router = inject(Router);

  readonly commentMax = COMMENT_MAX;

  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;
  selectedTab = 0;

  pending: BookingResponse[] = [];
  mine: ReviewResponse[] = [];

  // Hoja de valorar
  target: BookingResponse | null = null;
  rating = 5;
  comment = '';
  busy = false;
  sheetError: string | null = null;
  toast: string | null = null;

  readonly ratingWords = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', '¡Genial!'];

  ngOnInit(): void {
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (this.isAuthenticated) {
        void this.load();
      } else {
        this.isLoading = false;
      }
    });
  }

  /**
   * Las etiquetas con su cuenta. Un campo y no un getter: un array nuevo en
   * cada ciclo hace que Angular crea que la entrada cambió sin parar.
   */
  tabs: string[] = ['Pendientes', 'Tus reseñas'];

  private refreshTabs(): void {
    this.tabs = [
      this.pending.length ? `Pendientes (${this.pending.length})` : 'Pendientes',
      this.mine.length ? `Tus reseñas (${this.mine.length})` : 'Tus reseñas',
    ];
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      const [bookings, reviews] = await Promise.all([this.bookings.mine(), this.bookings.myReviews()]);
      // La reseña solo trae el id del negocio: el nombre sale de las citas.
      this.businessNames = new Map(
        bookings.filter(b => b.businessName).map(b => [b.businessId, b.businessName!] as [number, string]),
      );
      this.mine = [...reviews].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      this.pending = pendingOf(bookings, reviews);
      // Sin nada pendiente, se abre directamente en las ya escritas.
      if (this.pending.length === 0 && this.mine.length > 0) {
        this.selectedTab = 1;
      }
      this.refreshTabs();
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ----- VISTA --------------------

  stars(rating: number): number[] {
    return [1, 2, 3, 4, 5].map(i => (i <= Math.round(rating) ? 1 : 0));
  }

  image(booking: BookingResponse): string | null {
    return fixImageUrl(booking.serviceImageUrl) ?? null;
  }

  when(booking: BookingResponse): string {
    return longDate(parseLocal(booking.startDateTime));
  }

  reviewDate(review: ReviewResponse): string {
    if (!review.createdAt) return '';
    const date = new Date(review.createdAt);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  private businessNames = new Map<number, string>();

  businessOf(review: ReviewResponse): string {
    return this.businessNames.get(review.businessId) ?? 'Negocio';
  }

  businessLink(review: ReviewResponse): string[] {
    return businessPath({ id: review.businessId, name: this.businessNames.get(review.businessId) });
  }

  // ----- VALORAR --------------------

  openSheet(booking: BookingResponse): void {
    this.target = booking;
    this.rating = 5;
    this.comment = '';
    this.sheetError = null;
  }

  closeSheet(): void {
    if (!this.busy) {
      this.target = null;
    }
  }

  async submit(): Promise<void> {
    if (!this.target || this.busy) {
      return;
    }
    this.busy = true;
    this.sheetError = null;
    try {
      const review = await this.bookings.createReview({
        bookingId: this.target.id,
        rating: this.rating,
        comment: this.comment.trim() || undefined,
      });
      this.mine = [review, ...this.mine];
      this.pending = this.pending.filter(b => b.businessId !== this.target!.businessId);
      this.refreshTabs();
      this.target = null;
      this.showToast('¡Gracias por tu reseña!');
    } catch (raw) {
      this.sheetError = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  async remove(review: ReviewResponse): Promise<void> {
    if (!confirm('¿Borrar esta reseña? No se puede deshacer.')) {
      return;
    }
    try {
      await this.bookings.deleteReview(review.id);
      this.mine = this.mine.filter(r => r.id !== review.id);
      this.refreshTabs();
      this.showToast('Reseña borrada');
      // Puede volver a quedar pendiente: se recalcula con los datos del servidor.
      void this.load();
    } catch (raw) {
      this.showToast(ApiError.from(raw).message);
    }
  }

  private showToast(message: string): void {
    this.toast = message;
    setTimeout(() => (this.toast = null), 2600);
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/resenas' } });
  }

  goToAppointments(): void {
    this.router.navigate(['/citas']);
  }
}

/**
 * Citas que se pueden valorar: el servidor lo dice con `canReview`; si no lo
 * manda, la regla de la app —confirmada y ya terminada—. Sin reseña de esa
 * cita, y **una por negocio**, la más reciente.
 */
function pendingOf(bookings: BookingResponse[], reviews: ReviewResponse[]): BookingResponse[] {
  const reviewed = new Set(reviews.map(r => r.bookingId));
  const reviewedBusinesses = new Set(reviews.map(r => r.businessId));
  const now = Date.now();
  const candidates = bookings
    .filter(b => !reviewed.has(b.id))
    .filter(b => (b.canReview !== undefined
      ? b.canReview
      : b.status === 'CONFIRMED' && parseLocal(b.endDateTime).getTime() < now))
    .filter(b => b.canReview || !reviewedBusinesses.has(b.businessId))
    .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));

  const seen = new Set<number>();
  return candidates.filter(b => {
    if (seen.has(b.businessId)) return false;
    seen.add(b.businessId);
    return true;
  });
}
