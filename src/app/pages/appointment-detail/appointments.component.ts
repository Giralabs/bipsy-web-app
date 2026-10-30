import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { BookingResponse, bookingPrice, isBookingActive } from '../../models/bipsy.models';
import { isAwaitingCustomer } from '../../models/confirm.models';
import { ButtonComponent } from '../../components/button/button.component';
import { SegmentedComponent } from '../../components/segmented/segmented.component';
import { BookingCardComponent } from '../../components/booking-card/booking-card.component';
import { WaitlistSummaryComponent } from '../../components/waitlist/waitlist-summary.component';
import { capitalize, euros, parseLocal, relativeDate, time } from '../../shared/dates';
import { bookingCountdown } from '../../shared/booking-countdown';
import { businessBookingPath } from '../../shared/slug';
import { PaymentRequestGateService } from '../../components/payment-request-gate/payment-request-gate.service';
import { DeadlineCountdownComponent } from '../../components/deadline-countdown/deadline-countdown.component';
import { PendingPaymentRequest } from '../../models/payments-extras.models';
import { BreakpointService } from '../../core/breakpoint.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';

const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const MONTH_SHORT = new Intl.DateTimeFormat('es-ES', { month: 'short' });

interface MonthGroup {
  label: string;
  items: BookingResponse[];
}

/**
 * "Mis citas". Port de `MyBookingsScreen`.
 *
 * En el móvil, la pantalla de la app tal cual: título con tu foto, subtítulo,
 * el segmentado y la lista. En escritorio, con sitio, la próxima cita
 * destacada arriba, las listas agrupadas por mes y a un lado tus números y lo
 * que tienes pendiente de valorar.
 */
@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent, SegmentedComponent, BookingCardComponent, WaitlistSummaryComponent, DeadlineCountdownComponent, AvatarComponent],
  templateUrl: './appointments.component.html',
  styleUrl: './appointments.component.css',
})
export class AppointmentsComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly gate = inject(PaymentRequestGateService);

  /** El cobro que un negocio te está pidiendo, si lo hay. */
  readonly paymentRequest = this.gate.live;

  /** Escritorio o app: cada uno pinta su versión de la pantalla. */
  readonly desktop = inject(BreakpointService).desktop;

  tabs = ['Próximas', 'Pasadas'];
  /** Las de la app, sin contadores: el número no está en `MyBookingsScreen`. */
  readonly plainTabs = ['Próximas', 'Pasadas'];
  selectedTab = 0;

  get avatarPhoto(): string | null {
    return this.session.currentUser?.profileImageUrl ?? null;
  }

  get avatarName(): string | null {
    return this.session.currentUser?.name ?? null;
  }

  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  /** Citas que puso el negocio y esperan que las aceptes. */
  awaiting: BookingResponse[] = [];

  /**
   * «Tienes 2 citas por delante y 1 por confirmar.» Las por confirmar van
   * aparte: contaban como nada y el subtítulo decía «2» con tres en pantalla.
   */
  get aheadLabel(): string {
    const n = this.upcoming.length;
    const p = this.awaiting.length;
    const pending = p === 0 ? '' : ` y ${p} por confirmar`;
    if (n === 0) return p === 0 ? 'No tienes nada por delante.' : `Tienes ${p === 1 ? '1 cita' : p + ' citas'} por confirmar.`;
    return `Tienes ${n === 1 ? '1 cita' : n + ' citas'} por delante${pending}.`;
  }
  upcoming: BookingResponse[] = [];
  past: BookingResponse[] = [];
  upcomingGroups: MonthGroup[] = [];
  pastGroups: MonthGroup[] = [];

  /** Citas a las que fuiste, sitios distintos y reseñas por escribir. */
  visits = 0;
  places = 0;
  pendingReviews = 0;

  /** Abre la ventana de pagar aunque ya saltara antes: esto lo ha pedido él. */
  payNow(req: PendingPaymentRequest): void {
    this.gate.reopen(req);
  }

  payAmount(req: PendingPaymentRequest): string {
    return euros(req.amountCents / 100);
  }

  ngOnInit(): void {
    // Al entrar se vuelve a mirar si hay cobro pendiente: la tarjeta no puede
    // depender de que el sondeo de la raíz haya pasado justo antes.
    void this.gate.check();
    // Atada a la vida de la pantalla: `status$` vive lo que la web, y sin
    // cortarla cada visita a Mis citas dejaba una escucha más que volvía a
    // cargar citas en pantallas ya cerradas al entrar o salir de la cuenta.
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (this.isAuthenticated) {
        void this.load();
      } else {
        this.isLoading = false;
        this.awaiting = [];
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

      const awaiting: BookingResponse[] = [];

      for (const booking of all) {
        const start = parseLocal(booking.startDateTime).getTime();
        // Las que puso el negocio y esperan tu sí van aparte y arriba: tienen
        // un plazo de minutos. `isBookingActive` no las cuenta como vivas, así
        // que sin esto caían en «Pasadas».
        if (start > now && isAwaitingCustomer(booking)) {
          awaiting.push(booking);
        } else if (start > now && isBookingActive(booking)) {
          upcoming.push(booking);
        } else {
          past.push(booking);
        }
      }

      // Próximas: la más cercana primero. Pasadas: la más reciente primero.
      upcoming.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
      past.sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));

      awaiting.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
      this.awaiting = awaiting;
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

  /** "Faltan 3 días", "Faltan 5 h", "Empieza en 20 min". */
  get countdown(): string {
    return this.next ? bookingCountdown(parseLocal(this.next.startDateTime)) : '';
  }

  get nextPrice(): string | null {
    const price = this.next ? bookingPrice(this.next) : null;
    return price === null ? null : euros(price);
  }

  // ----- ACCIONES --------------------

  openBooking(booking: BookingResponse): void {
    // La que espera respuesta, a confirmarla: el detalle no tiene esos botones.
    this.router.navigate(
      isAwaitingCustomer(booking) ? ['/citas', booking.id, 'confirmar'] : ['/citas', booking.id],
    );
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
