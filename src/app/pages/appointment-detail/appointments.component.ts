import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { BookingResponse, isBookingActive } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { SegmentedComponent } from '../../components/segmented/segmented.component';
import { BookingCardComponent } from '../../components/booking-card/booking-card.component';
import { WaitlistSummaryComponent } from '../../components/waitlist/waitlist-summary.component';
import { parseLocal } from '../../shared/dates';
import { businessBookingPath } from '../../shared/slug';

/**
 * "Mis citas". Port de `MyBookingsScreen`.
 *
 * Dos listas de la misma cosa —próximas y pasadas—, así que un segmentado y no
 * pestañas. Sin sesión no se piden citas: se ofrece entrar.
 */
@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, ButtonComponent, SegmentedComponent, BookingCardComponent, WaitlistSummaryComponent],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css',
})
export class AppointmentsComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly tabs = ['Próximas', 'Pasadas'];
  selectedTab = 0;

  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  upcoming: BookingResponse[] = [];
  past: BookingResponse[] = [];

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
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  openBooking(booking: BookingResponse): void {
    this.router.navigate(['/appointments', booking.id]);
  }

  /**
   * Repetir la cita: al flujo de reserva con el mismo servicio y, si sigue
   * atendiéndolo, con aquel mismo profesional. Volver a elegir lo que ya
   * elegiste una vez es el trabajo que este botón existe para ahorrar.
   */
  rebook(booking: BookingResponse): void {
    this.router.navigate(
      businessBookingPath({ id: booking.businessId, name: booking.businessName }),
      { queryParams: { serviceId: booking.serviceId, workerId: booking.workerId } },
    );
  }

  openLogin(): void {
    this.session.openAuthModal('/appointments');
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/appointments' } });
  }

  goExplore(): void {
    this.router.navigate(['/home']);
  }
}
