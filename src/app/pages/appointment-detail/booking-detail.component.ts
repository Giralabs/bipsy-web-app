import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
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
  bookingPrice,
  businessLocationDisplay,
  isBookingActive,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { BookingStatusPillComponent } from '../../components/status-pill/booking-status-pill.component';
import { capitalize, duration, euros, longDate, parseLocal, time } from '../../shared/dates';
import { bookingCountdown } from '../../shared/booking-countdown';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { isAwaitingCustomer } from '../../models/confirm.models';
import { PaymentRepository } from '../../repositories/payment.repository';
import { BookingQuote, cents, quoteIsHeld, quoteUsable } from '../../models/payments-extras.models';
import { PayBookingSheetComponent } from '../../components/pay-booking-sheet/pay-booking-sheet.component';
import {
  BookingChargeOutcome,
  BookingChargeSheetComponent,
} from '../../components/booking-charge-sheet/booking-charge-sheet.component';
import { PaymentRequestGateService } from '../../components/payment-request-gate/payment-request-gate.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { addressOneLine } from '../../models/booking-extras.models';
import { REVIEW_COMMENT_MAX, REVIEW_NEEDS_STARS, reviewStarLabel } from '../reviews/review-labels';
import { BreakpointService } from '../../core/breakpoint.service';

const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });
const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAY_DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' });

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
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    BookingStatusPillComponent,
    PayBookingSheetComponent,
    BookingChargeSheetComponent,
  ],
  templateUrl: './booking-detail.component.html',
  styleUrl: './booking-detail.component.css',
})
export class BookingDetailComponent implements OnInit {
  private readonly bookings = inject(BookingRepository);
  private readonly dialog = inject(DialogService);
  private readonly catalog = inject(CatalogRepository);
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly payments = inject(PaymentRepository);
  private readonly toasts = inject(ToastService);
  private readonly gate = inject(PaymentRequestGateService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Lo que falta por pagar de esta cita, si el negocio cobra por la web. Se
   * pregunta siempre que siga en pie: pagar después del servicio es tan válido
   * como al reservar, y es justo lo que hace el modo «opcional».
   */
  quote: BookingQuote | null = null;
  paySheetOpen = false;
  chargeSheetOpen = false;

  booking?: BookingResponse;
  business?: BusinessResponse;
  fee: CancellationFee | null = null;
  myReview: ReviewResponse | null = null;

  isLoading = true;
  loadError: ApiError | null = null;
  busy = false;
  actionError: string | null = null;

  // Hoja de reseña. Sin estrellas de partida, como la app: con cinco puestas,
  // quien no toca nada publica un «Excelente» que no ha dicho.
  reviewOpen = false;
  reviewRating = 0;
  reviewComment = '';
  readonly starLabel = reviewStarLabel;
  readonly commentMax = REVIEW_COMMENT_MAX;

  async ngOnInit(): Promise<void> {
    if (!this.session.isAuthenticated && !this.session.tokenLooksPresent) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    // Pagada desde la ventana que salta sola: aquí ya no hay que ofrecer
    // «Pagar», y sin esto el botón seguiría ahí hasta recargar.
    this.gate.paid$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(bookingId => {
      if (bookingId === this.booking?.id) void this.loadQuote();
    });
    // ⚠️ Por el id de la RUTA, no una sola vez: de una cita a otra (un aviso,
    // la ventana de cobro) Angular reutiliza esta misma pantalla, y con solo
    // `ngOnInit` se quedaba enseñando la cita anterior bajo la URL nueva.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetForReload();
      void this.load();
    });
  }

  /** Lo de la cita anterior fuera, para no pintarlo un instante con la nueva. */
  private resetForReload(): void {
    this.business = undefined;
    this.fee = null;
    this.quote = null;
    this.myReview = null;
    this.actionError = null;
    this.paySheetOpen = false;
    this.chargeSheetOpen = false;
    this.reviewOpen = false;
  }

  async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.isLoading = true;
    this.loadError = null;
    try {
      this.booking = await this.bookings.byId(id);
      // Una cita que te ha dado el negocio y espera tu respuesta no se gestiona
      // aquí —cancelar o cambiar algo que aún no has aceptado no tiene
      // sentido—: tiene su propia pantalla, la de confirmarla.
      if (isAwaitingCustomer(this.booking)) {
        void this.router.navigate(['/citas', id, 'confirmar'], { replaceUrl: true });
        return;
      }
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
    await this.loadQuote();
  }

  // ----- PAGO DE LA CITA --------------------

  async loadQuote(): Promise<void> {
    if (!this.booking || !isBookingActive(this.booking)) {
      this.quote = null;
      return;
    }
    try {
      this.quote = await this.payments.bookingQuote(this.booking.id);
    } catch {
      // Sin presupuesto no se ofrece pagar: mejor eso que un botón que falla.
      this.quote = null;
    }
  }

  get canPay(): boolean {
    return quoteUsable(this.quote) && this.quote.dueCents > 0;
  }

  get payLabel(): string {
    return `Pagar ${cents(this.quote?.dueCents)}`;
  }

  get payRequired(): boolean {
    return !!this.quote?.required;
  }

  /**
   * El importe reservado en la tarjeta, esperando a que el negocio acepte. No
   * es un botón —no hay nada que hacer—, pero callárselo le deja buscando un
   * cargo que su banco todavía no le enseña.
   */
  get heldNote(): string | null {
    return quoteIsHeld(this.quote)
      ? `Tienes ${cents(this.quote!.heldCents)} reservados en tu tarjeta. Se cobran cuando el negocio acepte la cita.`
      : null;
  }

  openPay(): void {
    if (this.canPay) this.paySheetOpen = true;
  }

  async onPayClosed(paid: boolean): Promise<void> {
    this.paySheetOpen = false;
    if (paid) await this.loadQuote();
  }

  // ----- VISTA --------------------

  /** Escritorio o app: en el móvil se pinta `BookingDetailScreen` tal cual. */
  readonly desktop = inject(BreakpointService).desktop;

  /** Te la dio el negocio y espera tu respuesta: lo único que hay que hacer. */
  get awaiting(): boolean {
    return !!this.booking && isAwaitingCustomer(this.booking);
  }

  /**
   * Con los mensajes apagados, abrir el hilo responde 403: el botón solo
   * serviría para enseñar un error. Sin el dato, se ofrece, como antes.
   */
  get chatEnabled(): boolean {
    return this.booking?.businessChatEnabled !== false;
  }

  goConfirm(): void {
    if (this.booking) {
      this.router.navigate(['/citas', this.booking.id, 'confirmar']);
    }
  }

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

  /** A domicilio: el profesional va a casa del cliente y la calle del local no importa. */
  get atCustomer(): boolean {
    return this.booking?.servicePlace === 'AT_CUSTOMER';
  }

  /**
   * La dirección de la cabecera. Vacía en una cita a domicilio: ahí lo que
   * importa es la de «Dónde», y la del local llevaría a otro sitio.
   */
  get headerAddress(): string {
    return this.atCustomer ? '' : this.locationDisplay;
  }

  /** La dirección de casa en una línea, o '' si la cita no la tiene guardada. */
  get homeAddressLine(): string {
    return this.atCustomer ? addressOneLine(this.booking?.address) : '';
  }

  /**
   * La búsqueda para el mapa: calle, código postal y ciudad. Sin el piso ni
   * la provincia, como `BookingAddress.mapQuery`: con ellos Maps afina peor.
   */
  get homeMapsUrl(): string | null {
    const a = this.atCustomer ? this.booking?.address : null;
    if (!a) return null;
    if (typeof a.latitude === 'number' && typeof a.longitude === 'number') {
      return `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`;
    }
    const query = [a.address, a.postalCode, a.city].map(v => v?.trim() ?? '').filter(Boolean).join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  }

  /** «Para Marta», si la cita no es para quien la reservó. */
  get attendeeLabel(): string | null {
    const name = this.booking?.attendeeName?.trim();
    return name ? `Para ${name}` : null;
  }

  /** El negocio cobra por cancelar tarde esta cita, se esté o no en la ventana. */
  get hasPolicy(): boolean {
    return (this.fee?.policyFeePercent ?? 0) > 0;
  }

  get policyAmount(): string {
    return euros((this.fee?.policyAmountCents ?? 0) / 100);
  }

  /**
   * «hoy a las 10:00» · «mañana a las 10:00» · «el jueves 21 a las 10:00». Port
   * de `_deadlineLabel`: los dos primeros días en relativo porque es cuando la
   * hora límite obliga a decidir. Null si ya pasó o no hay plazo: no hay nada
   * que prometer.
   */
  get freeUntilLabel(): string | null {
    const raw = this.fee?.freeUntil;
    if (!raw) return null;
    const deadline = parseLocal(raw);
    if (deadline.getTime() <= Date.now()) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
    const hour = time(deadline);
    if (days === 0) return `hoy a las ${hour}`;
    if (days === 1) return `mañana a las ${hour}`;
    return `el ${WEEKDAY_DAY.format(deadline)} a las ${hour}`;
  }

  // ----- CABECERA Y BLOQUES --------------------

  get weekdayLabel(): string {
    return this.booking ? capitalize(WEEKDAY.format(parseLocal(this.booking.startDateTime))) : '';
  }

  get dayMonthLabel(): string {
    return this.booking ? DAY_MONTH.format(parseLocal(this.booking.startDateTime)) : '';
  }

  get durationLabel(): string {
    if (!this.booking) return '';
    const minutes = Math.round(
      (parseLocal(this.booking.endDateTime).getTime() - parseLocal(this.booking.startDateTime).getTime()) / 60_000,
    );
    return duration(minutes);
  }

  get priceLabel(): string | null {
    const price = this.booking ? bookingPrice(this.booking) : null;
    return price === null ? null : euros(price);
  }

  /** "Faltan 3 días" para las futuras; nada para el resto. */
  get countdown(): string | null {
    if (!this.booking || !this.canCancel) return null;
    return bookingCountdown(parseLocal(this.booking.startDateTime));
  }

  /** La cita ya pasó (o se canceló): se ofrece repetirla. */
  get canRebook(): boolean {
    return !!this.booking && !this.canCancel;
  }

  get directionsUrl(): string | null {
    const b = this.business;
    // A domicilio no se va al local: el mapa que vale es el de «Dónde».
    if (!b || b.worksAtHome || this.atCustomer) return null;
    if (typeof b.latitude === 'number' && typeof b.longitude === 'number') {
      return `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
    }
    const where = [b.address, b.city].filter(Boolean).join(', ');
    return where ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}` : null;
  }

  /**
   * Añadir a Google Calendar. Fechas sin zona a propósito: la cita es a esa
   * hora en el reloj del negocio, y Calendar la interpreta en la del usuario.
   */
  get calendarUrl(): string | null {
    const b = this.booking;
    if (!b || !this.canCancel) return null;
    const stamp = (value: string) => value.slice(0, 19).replace(/[-:]/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${b.serviceName} · ${this.business?.name ?? b.businessName ?? 'Bipsy'}`,
      dates: `${stamp(b.startDateTime)}/${stamp(b.endDateTime)}`,
      details: `Cita reservada con Bipsy${b.workerName ? ' con ' + b.workerName : ''}.`,
      location: this.atCustomer ? this.homeAddressLine : this.locationDisplay,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  rebook(): void {
    if (!this.booking) return;
    this.router.navigate(
      businessBookingPath({ id: this.booking.businessId, name: this.business?.name ?? this.booking.businessName }),
      { queryParams: { serviceId: this.booking.serviceId, workerId: this.booking.workerId } },
    );
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
    this.router.navigate(['/citas', this.booking!.id, 'cambiar']);
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
    // La tarifa se vuelve a pedir justo ahora: la de la carga puede ser de hace
    // un rato —quien deja la ficha abierta puede haber entrado ya en la
    // ventana— o haber fallado, y en los dos casos se le diría «cancelar» sin
    // importe y el servidor cobraría igual. Si falla otra vez, se queda la que
    // había.
    this.busy = true;
    try {
      this.fee = await this.bookings.cancellationFee(this.booking.id);
    } catch {
      // Sin respuesta se sigue con lo que se sabía.
    } finally {
      this.busy = false;
    }

    // Con cargo, la hoja de cobro: importe, tarjeta, cobro y recibo con el
    // resultado REAL del banco. Sin cargo basta con preguntar.
    if (this.willCharge) {
      this.actionError = null;
      this.chargeSheetOpen = true;
      return;
    }

    const ok = await this.dialog.confirm({
      title: '¿Cancelar la cita?',
      message: `Tu cita de «${this.booking.serviceName}» se anula y el hueco queda libre. No se puede deshacer.`,
      confirmLabel: 'Cancelar cita',
      destructive: true,
    });
    if (!ok) {
      return;
    }

    this.busy = true;
    this.actionError = null;
    try {
      this.booking = await this.bookings.cancel(this.booking.id);
      this.fee = null;
      this.quote = null;
      this.toasts.success('Cita cancelada.');
    } catch (raw) {
      const error = ApiError.from(raw);
      this.actionError = error.isConflict
        ? 'Esta cita ya no se puede cancelar.'
        : 'No se ha podido cancelar. Inténtalo de nuevo.';
    } finally {
      this.busy = false;
    }
  }

  /**
   * Lo que hace la hoja de cobro al confirmar. La cita nueva se guarda aquí
   * mismo: si el cargo falla, la cita queda igual de cancelada y la pantalla
   * lo tiene que enseñar.
   */
  readonly cancelForCharge = async (): Promise<void> => {
    this.booking = await this.bookings.cancel(this.booking!.id);
  };

  get chargeConcept(): string {
    return `Cancelación · ${this.booking?.serviceName ?? ''}`;
  }

  onChargeClosed(outcome: BookingChargeOutcome): void {
    this.chargeSheetOpen = false;
    if (!outcome.done) return;
    this.fee = null;
    this.quote = null;
    if (outcome.openPayments) {
      this.router.navigate(['/pagos']);
    }
  }

  // ----- RESEÑA --------------------

  /** Escape cierra la hoja de reseña, como todas las demás hojas. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.reviewOpen && !this.busy) {
      this.reviewOpen = false;
    }
  }

  openReview(): void {
    this.reviewOpen = true;
    this.reviewRating = 0;
    this.reviewComment = '';
    this.actionError = null;
  }

  setReviewRating(n: number): void {
    this.reviewRating = n;
    this.actionError = null;
  }

  async submitReview(): Promise<void> {
    if (!this.booking || this.busy) {
      return;
    }
    if (this.reviewRating === 0) {
      this.actionError = REVIEW_NEEDS_STARS;
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
      this.toasts.success('¡Gracias por tu reseña!');
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isConflict) {
        // 409: ya tenía reseña (desde otra pestaña u otro dispositivo). Lo
        // que quería ya está hecho: se cierra y se trae la que hay.
        this.reviewOpen = false;
        try {
          const mine = await this.bookings.myReviews();
          this.myReview = mine.find(r => r.bookingId === this.booking!.id) ?? null;
        } catch {
          // Sin la lista, la pantalla sigue igual de válida.
        }
      } else {
        this.actionError = error.message;
      }
    } finally {
      this.busy = false;
    }
  }

  async deleteReview(): Promise<void> {
    if (!this.myReview || this.busy) {
      return;
    }
    const ok = await this.dialog.confirm({
      title: '¿Eliminar tu reseña?',
      message: 'El negocio dejará de verla. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) {
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
