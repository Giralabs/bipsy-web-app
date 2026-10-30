import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BookingRepository } from '../../repositories/booking.repository';
import { DialogService } from '../../core/dialog.service';
import { BookingResponse, ReviewResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { SegmentedComponent } from '../../components/segmented/segmented.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { fixImageUrl } from '../../shared/image-url';
import { longDate, parseLocal } from '../../shared/dates';
import { businessPath } from '../../shared/slug';
import { ToastService } from '../../core/toast.service';
import { REVIEW_COMMENT_MAX, REVIEW_NEEDS_STARS, reviewStarLabel } from './review-labels';

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
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent, SegmentedComponent, AvatarComponent],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class ReviewsComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly bookings = inject(BookingRepository);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toasts = inject(ToastService);
  private readonly catalog = inject(CatalogRepository);

  readonly commentMax = REVIEW_COMMENT_MAX;
  readonly starLabel = reviewStarLabel;

  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;
  selectedTab = 0;

  pending: BookingResponse[] = [];
  mine: ReviewResponse[] = [];

  // Hoja de valorar. Sin estrellas de partida, como la app: con cinco puestas
  // de antemano, quien no toca nada publica un «Excelente» que no ha dicho.
  target: BookingResponse | null = null;
  rating = 0;
  comment = '';
  busy = false;
  sheetError: string | null = null;

  ngOnInit(): void {
    // Cortada al salir: la sesión no completa nunca, y cada visita dejaba
    // viva una suscripción que volvía a cargar las reseñas al iniciar sesión.
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
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
      void this.loadPhotos();
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

  when(booking: BookingResponse): string {
    return longDate(parseLocal(booking.startDateTime));
  }

  private businessNames = new Map<number, string>();

  /**
   * La foto de cada negocio, como `_BusinessAvatar` de la app. Se pide DESPUÉS
   * de pintar la lista y sin bloquearla: mientras llega sale la inicial, y un
   * negocio que falle se queda con ella.
   */
  private businessPhotos = new Map<number, string | null>();

  private async loadPhotos(): Promise<void> {
    const ids = [...new Set([...this.pending.map(b => b.businessId), ...this.mine.map(r => r.businessId)])]
      .filter(id => !this.businessPhotos.has(id));
    await Promise.all(ids.map(async id => {
      try {
        const business = await this.catalog.business(id);
        this.businessPhotos.set(id, fixImageUrl(business.profileImageUrl) ?? null);
        if (!this.businessNames.has(id) && business.name) this.businessNames.set(id, business.name);
      } catch {
        this.businessPhotos.set(id, null);
      }
    }));
  }

  photoOf(businessId: number): string | null {
    return this.businessPhotos.get(businessId) ?? null;
  }

  /** «16 sept 2026», como el `d MMM y` de la tarjeta de la app. */
  shortDate(review: ReviewResponse): string {
    if (!review.createdAt) return '';
    const date = new Date(review.createdAt);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
  }

  businessOf(review: ReviewResponse): string {
    return this.businessNames.get(review.businessId) ?? 'Negocio';
  }

  businessLink(review: ReviewResponse): string[] {
    return businessPath({ id: review.businessId, name: this.businessNames.get(review.businessId) });
  }

  // ----- VALORAR --------------------

  openSheet(booking: BookingResponse): void {
    this.target = booking;
    this.rating = 0;
    this.comment = '';
    this.sheetError = null;
  }

  setRating(n: number): void {
    this.rating = n;
    this.sheetError = null;
  }

  /** Escape cierra la hoja, como todas las demás. */
  @HostListener('document:keydown.escape')
  closeSheet(): void {
    if (!this.busy) {
      this.target = null;
    }
  }

  async submit(): Promise<void> {
    if (!this.target || this.busy) {
      return;
    }
    if (this.rating === 0) {
      this.sheetError = REVIEW_NEEDS_STARS;
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
      this.toasts.success('¡Gracias por tu reseña!');
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isConflict) {
        // 409: esa cita ya tenía reseña (otra pestaña, otro dispositivo). Lo
        // que el usuario quería ya está hecho: se cierra y se recarga.
        this.target = null;
        void this.load();
      } else {
        this.sheetError = error.message;
      }
    } finally {
      this.busy = false;
    }
  }

  async remove(review: ReviewResponse): Promise<void> {
    const ok = await this.dialog.confirm({
      title: '¿Borrar esta reseña?',
      message: 'El negocio dejará de verla. No se puede deshacer.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      await this.bookings.deleteReview(review.id);
      this.mine = this.mine.filter(r => r.id !== review.id);
      this.refreshTabs();
      this.toasts.success('Reseña borrada');
      // Puede volver a quedar pendiente: se recalcula con los datos del servidor.
      void this.load();
    } catch (raw) {
      // Antes salía con el mismo aviso verde que un acierto.
      this.toasts.error(ApiError.from(raw).message);
    }
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
