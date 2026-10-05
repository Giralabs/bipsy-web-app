import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { BookingResponse, bookingPrice, isBookingActive } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { SegmentedComponent } from '../../components/segmented/segmented.component';
import { BookingCardComponent } from '../../components/booking-card/booking-card.component';
import { WaitlistSummaryComponent } from '../../components/waitlist/waitlist-summary.component';
import { capitalize, euros, parseLocal, relativeDate, time } from '../../shared/dates';
import { businessBookingPath } from '../../shared/slug';

const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('es-ES', { month: 'short' });

interface MonthGroup {
  label: string;
  items: BookingResponse[];
}

/**
 * "Mis citas". Port de `MyBookingsScreen`.
 *
 * La próxima cita, destacada arriba: es lo que se viene a mirar. Debajo, las
 * dos listas —próximas y pasadas— agrupadas por mes, y a un lado tus números y
 * lo que tienes pendiente de valorar.
 */
@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, SegmentedComponent, BookingCardComponent, WaitlistSummaryComponent],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css',
})
export class AppointmentsComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  tabs = ['Próximas', 'Pasadas'];
  selectedTab = 0;

  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  upcoming: BookingResponse[] = [];
  past: BookingResponse[] = [];
  upcomingGroups: MonthGroup[] = [];
  pastGroups: MonthGroup[] = [];

  /** Citas a las que fuiste, sitios distintos y reseñas por escribir. */
  visits = 0;
  places = 0;
  pendingReviews = 0;

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
        this.upcoming = [];
        this.past = [];
      }
    });
  }

  get groups(): MonthGroup[] {
    return this.selectedTab === 0 ? this.upcomingGroups : this.pastGroups;
  }

  get items(): BookingResponse[] {
    return this.selectedTab === 0 ? this.upcoming : this.past;
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      const all = await this.bipsy.getMyBookings();
      const now = Date.now();
      const upcoming: BookingResponse[] = [];
      const past: BookingResponse[] = [];

      for (const booking of all) {
        const start = parseLocal(booking.startDateTime).getTime();
        if (start > now && isBookingActive(booking)) {
          upcoming.push(booking);
        } else {
          past.push(booking);
        }
      }

      // Próximas: la más cercana primero. Pasadas: la más reciente primero.
      upcoming.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
      past.sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));

      this.upcoming = upcoming;
      this.past = past;
      // La destacada no se repite en la lista de debajo.
      this.upcomingGroups = groupByMonth(upcoming.slice(1));
      this.pastGroups = groupByMonth(past);
      this.tabs = [
        upcoming.length ? `Próximas (${upcoming.length})` : 'Próximas',
        past.length ? `Pasadas (${past.length})` : 'Pasadas',
      ];

      this.visits = past.filter(b => b.status === 'CONFIRMED').length;
      this.places = new Set(all.filter(b => b.status !== 'CANCELED').map(b => b.businessId)).size;
      this.pendingReviews = past.filter(b => b.canReview).length;
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ----- LA PRÓXIMA --------------------

  get next(): BookingResponse | null {
    return this.upcoming[0] ?? null;
  }

  get nextDay(): string {
    return this.next ? String(parseLocal(this.next.startDateTime).getDate()) : '';
  }

  get nextMonth(): string {
    return this.next ? MONTH_SHORT.format(parseLocal(this.next.startDateTime)).replace('.', '') : '';
  }

  get nextWhen(): string {
    if (!this.next) return '';
    const start = parseLocal(this.next.startDateTime);
    return `${relativeDate(start)} · ${time(start)} – ${time(parseLocal(this.next.endDateTime))}`;
  }

  /** "Faltan 3 días", "Faltan 5 h", "En 20 min". */
  get countdown(): string {
    if (!this.next) return '';
    const ms = parseLocal(this.next.startDateTime).getTime() - Date.now();
    const minutes = Math.max(0, Math.round(ms / 60_000));
    if (minutes < 60) return `En ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Faltan ${hours} h`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'Falta 1 día' : `Faltan ${days} días`;
  }

  get nextPrice(): string | null {
    const price = this.next ? bookingPrice(this.next) : null;
    return price === null ? null : euros(price);
  }

  // ----- ACCIONES --------------------

  openBooking(booking: BookingResponse): void {
    this.router.navigate(['/citas', booking.id]);
  }

  /**
   * Repetir la cita: al flujo de reserva con el mismo servicio y, si sigue
   * atendiéndolo, con aquel mismo profesional.
   */
  rebook(booking: BookingResponse): void {
    this.router.navigate(
      businessBookingPath({ id: booking.businessId, name: booking.businessName }),
      { queryParams: { serviceId: booking.serviceId, workerId: booking.workerId } },
    );
  }

  openLogin(): void {
    this.session.openAuthModal('/citas');
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/citas' } });
  }

  goExplore(): void {
    this.router.navigate(['/buscar']);
  }
}

function groupByMonth(list: BookingResponse[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const booking of list) {
    const label = capitalize(MONTH_YEAR.format(parseLocal(booking.startDateTime)));
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(booking);
    } else {
      groups.push({ label, items: [booking] });
    }
  }
  return groups;
}
