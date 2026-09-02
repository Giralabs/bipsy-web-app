import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { WaitlistRepository } from '../../repositories/waitlist.repository';
import {
  AvailabilitySlot,
  BusinessResponse,
  ServiceResponse,
  WorkerResponse,
  chargesCancellation,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { PaymentRepository } from '../../repositories/payment.repository';
import { euros, isoDate, isoLocalDateTime, longDate, duration, relativeDate } from '../../shared/dates';
import { businessIdFromParam, businessPath } from '../../shared/slug';

type Step = 'service' | 'worker' | 'date' | 'time' | 'confirm' | 'done';

/**
 * Flujo de reserva. Port de `BookingFlowScreen` y sus cuatro pasos.
 *
 * El paso de profesional se salta cuando no hay nada que elegir —negocio
 * autónomo, o un servicio con un solo profesional—, pero el `workerId` se
 * rellena igualmente: sin él el `POST /bookings` falla.
 */
@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, AddCardSheetComponent, AvatarComponent],
  templateUrl: './booking-flow.component.html',
  styleUrl: './booking-flow.component.css',
})
export class BookingFlowComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly session = inject(SessionService);
  private readonly waitlist = inject(WaitlistRepository);
  private readonly payments = inject(PaymentRepository);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  step: Step = 'service';
  loading = true;
  submitting = false;
  error: string | null = null;

  business?: BusinessResponse;
  services: ServiceResponse[] = [];
  workers: WorkerResponse[] = [];

  service?: ServiceResponse;
  workerId?: number;
  day?: Date;
  slots: AvailabilitySlot[] = [];
  slotsLoading = false;
  startTime?: string;
  notes = '';
  acceptedPolicy = false;

  bookingId?: number;

  // ----- TARJETA --------------------
  //
  // Un negocio puede exigir tarjeta guardada para aceptar reservas. Si no la
  // hay, el servidor rechaza el POST con 402 y antes eso era un callejón: el
  // mensaje decía que hacía falta una tarjeta y el único sitio para ponerla
  // era Ajustes › Pagos, con la reserva a medias. Ahora se guarda aquí mismo,
  // igual que `AddCardSheet` en la app.
  /** null mientras no se sabe: no se puede decidir el botón hasta saberlo. */
  hasCard: boolean | null = null;
  cardSheetOpen = false;
  stripeKey: string | null = null;

  // ----- LISTA DE ESPERA --------------------
  //
  // Sin hueco ese día, apuntarse es la única salida que no es "prueba otra
  // fecha y suerte". Solo se ofrece si el negocio la tiene encendida.
  waitlistBusy = false;
  waitlistDone = false;

  /** Los días que se ofrecen. El horizonte lo fija el negocio. */
  days: Date[] = [];

  async ngOnInit(): Promise<void> {
    const businessId = businessIdFromParam(this.route.snapshot.paramMap.get('id'));
    const params = this.route.snapshot.queryParams;

    // ⚠️ Hay que ESPERAR a que la sesión se resuelva antes de decidir.
    //
    // `restore()` es asíncrono: al entrar por enlace directo o al recargar,
    // `status` todavía vale 'unknown' cuando corre este `ngOnInit`, y
    // `requireAuth()` —que solo mira si vale 'authenticated'— devolvía false
    // teniendo el usuario una sesión perfectamente válida. Resultado: recargar
    // la pantalla de reserva te echaba al login. El resto de páginas con sesión
    // ya se suscriben a `status$`; esta era la única que preguntaba en seco.
    const status = await firstValueFrom(
      this.session.status$.pipe(filter(value => value !== 'unknown'), take(1)),
    );
    if (status !== 'authenticated') {
      this.session.requireAuth(this.router.url);
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }

    try {
      const [business, services] = await Promise.all([
        this.bipsy.getBusinessById(businessId!),
        this.bipsy.getBusinessServices(businessId!),
      ]);
      this.business = business;
      this.services = services.filter(s => s.active);
      this.buildDays(business.availabilityHorizonDays ?? 60);

      // "Volver a reservar" entra con el servicio (y a veces el profesional)
      // de la última cita. Si ese servicio ya no está en el catálogo, se cae a
      // elegirlo a mano en vez de arrancar un flujo vacío.
      const preselected = Number(params['serviceId']);
      const found = this.services.find(s => s.id === preselected);
      if (found) {
        await this.chooseService(found, Number(params['workerId']) || undefined);
      }
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.loading = false;
    }
  }

  // ----- PASOS --------------------

  async chooseService(service: ServiceResponse, preselectedWorkerId?: number): Promise<void> {
    this.service = service;
    this.workerId = preselectedWorkerId;

    const workerIds = service.workerIds ?? [];
    const skipWorker = !!this.business?.autonomous || workerIds.length <= 1;

    if (skipWorker) {
      // Con un solo profesional no hay nada que elegir, pero el id hace falta
      // igual: sin él el POST falla por `workerId` nulo.
      this.workerId = this.workerId ?? workerIds[0];
      this.step = 'date';
      return;
    }

    if (this.workers.length === 0 && this.business) {
      try {
        this.workers = await this.bipsy.getBusinessWorkers(this.business.id);
      } catch {
        // Sin la lista de profesionales se sigue: el servidor asignará uno
        // disponible. Peor sería quedarse sin poder reservar.
        this.workers = [];
      }
    }

    this.step = this.workerId ? 'date' : 'worker';
  }

  chooseWorker(workerId?: number): void {
    this.workerId = workerId;
    this.step = 'date';
  }

  async chooseDay(day: Date): Promise<void> {
    this.day = day;
    this.startTime = undefined;
    this.step = 'time';
    await this.loadSlots();
  }

  async loadSlots(): Promise<void> {
    if (!this.service || !this.day) {
      return;
    }
    this.slotsLoading = true;
    this.error = null;
    try {
      const res = await this.bipsy.getAvailability(this.service.id, isoDate(this.day), this.workerId);
      this.slots = res.slots ?? [];
    } catch (raw) {
      this.error = ApiError.from(raw).message;
      this.slots = [];
    } finally {
      this.slotsLoading = false;
    }
  }

  chooseSlot(slot: AvailabilitySlot): void {
    if (!slot.available) {
      return;
    }
    this.startTime = slot.start;
    this.step = 'confirm';
    // Se mira al entrar en el resumen y no antes: solo hace falta aquí, y
    // preguntarlo en cada paso serían tres llamadas para nada.
    void this.checkCard();
  }

  /**
   * ¿Hay tarjeta guardada? Solo se pregunta si el negocio la exige.
   *
   * Si la consulta falla se deja en `false`: el botón dirá «Añadir tarjeta y
   * continuar», que como mucho enseña una hoja de más. Suponer que sí la hay
   * llevaría a un 402 al confirmar, que es el callejón que se venía a quitar.
   */
  private async checkCard(): Promise<void> {
    if (!this.business?.requiresCard) {
      this.hasCard = true;
      return;
    }
    try {
      const [config, methods] = await Promise.all([
        this.payments.config(),
        this.payments.methods(),
      ]);
      this.stripeKey = config.publishableKey ?? null;
      this.hasCard = methods.length > 0;
    } catch {
      this.hasCard = false;
    }
  }

  /** True cuando falta la tarjeta que el negocio exige. */
  get needsCard(): boolean {
    return !!this.business?.requiresCard && this.hasCard === false;
  }

  /** El botón del resumen cambia de texto y de acción según falte o no. */
  get confirmLabel(): string {
    return this.needsCard ? 'Añadir tarjeta y continuar' : 'Confirmar reserva';
  }

  get confirmIcon(): string {
    return this.needsCard ? 'credit_card' : 'check_circle';
  }

  async openCardSheet(): Promise<void> {
    if (!this.stripeKey) {
      this.error = 'La pasarela de pago no está disponible ahora mismo. '
        + 'Prueba más tarde o elige otro negocio.';
      return;
    }
    this.error = null;
    this.cardSheetOpen = true;
    // La hoja se pinta primero y se prepara después: `open()` necesita que su
    // hueco exista para montar el formulario de Stripe.
    setTimeout(async () => {
      const ok = await this.cardSheet?.open();
      if (!ok) {
        this.cardSheetOpen = false;
        this.error = this.cardSheet?.error ?? 'No hemos podido abrir la pasarela de pago.';
      }
    });
  }

  /** Tarjeta guardada: se cierra la hoja y se confirma sin más pasos. */
  onCardSaved(): void {
    this.cardSheetOpen = false;
    this.hasCard = true;
    void this.confirm();
  }

  onCardSheetClosed(): void {
    this.cardSheetOpen = false;
  }

  /** Lo que hace el botón grande del resumen. */
  confirmOrAddCard(): void {
    if (this.needsCard) {
      void this.openCardSheet();
      return;
    }
    void this.confirm();
  }

  async confirm(): Promise<void> {
    if (!this.service || !this.day || !this.startTime || this.submitting) {
      return;
    }
    if (this.needsPolicyAcceptance && !this.acceptedPolicy) {
      this.error = 'Tienes que aceptar la política de cancelación para reservar.';
      return;
    }

    this.submitting = true;
    this.error = null;
    try {
      const booking = await this.bipsy.createBooking({
        serviceId: this.service.id,
        workerId: this.workerId,
        startDateTime: isoLocalDateTime(this.day, this.startTime),
        notes: this.notes.trim() || undefined,
        acceptedPolicy: this.acceptedPolicy,
      });
      this.bookingId = booking.id;
      this.step = 'done';
    } catch (raw) {
      const error = ApiError.from(raw);
      // El servidor dice que falta la tarjeta: se corrige el estado para que
      // el botón pase a ofrecer guardarla en vez de repetir el mismo error.
      if (error.isPaymentRequired) {
        this.hasCard = false;
        void this.checkCard();
      }
      this.error = bookingErrorMessage(error);
    } finally {
      this.submitting = false;
    }
  }

  /** El profesional elegido, o undefined si lo asigna el negocio. */
  get chosenWorker(): WorkerResponse | undefined {
    return this.workers.find(w => w.id === this.workerId);
  }

  get canJoinWaitlist(): boolean {
    return !!this.business?.waitlistEnabled && !!this.service && !this.waitlistDone;
  }

  /**
   * Apuntarse a la lista de espera de ese día.
   *
   * El rango va del día elegido a una semana después: apuntarse "solo para
   * hoy" casi nunca casa, y el negocio necesita margen para encontrar hueco.
   */
  async joinWaitlist(): Promise<void> {
    if (!this.service || !this.day || this.waitlistBusy) {
      return;
    }
    const until = new Date(this.day);
    until.setDate(until.getDate() + 7);

    this.waitlistBusy = true;
    this.error = null;
    try {
      await this.waitlist.join({
        serviceId: this.service.id,
        workerId: this.workerId,
        dateFrom: isoDate(this.day),
        dateTo: isoDate(until),
      });
      this.waitlistDone = true;
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.waitlistBusy = false;
    }
  }

  back(): void {
    this.error = null;
    switch (this.step) {
      case 'worker': this.step = 'service'; break;
      case 'date': this.step = this.showWorkerStep ? 'worker' : 'service'; break;
      case 'time': this.step = 'date'; break;
      case 'confirm': this.step = 'time'; break;
      default:
        if (this.business) {
          this.router.navigate(businessPath(this.business));
        }
    }
  }

  // ----- VISTA --------------------

  get showWorkerStep(): boolean {
    const workerIds = this.service?.workerIds ?? [];
    return !this.business?.autonomous && workerIds.length > 1;
  }

  get availableSlots(): AvailabilitySlot[] {
    return this.slots.filter(s => s.available);
  }

  get needsPolicyAcceptance(): boolean {
    return !!this.business && chargesCancellation(this.business);
  }

  get workerName(): string {
    if (!this.workerId) {
      return 'Cualquiera disponible';
    }
    return this.workers.find(w => w.id === this.workerId)?.name ?? `Profesional #${this.workerId}`;
  }

  get dayLabel(): string {
    return this.day ? longDate(this.day) : '';
  }

  price(service: ServiceResponse): string {
    return euros(service.price);
  }

  durationLabel(service: ServiceResponse): string {
    return duration(service.duration);
  }

  dayShort(day: Date): string {
    return relativeDate(day);
  }

  goToBooking(): void {
    this.router.navigate(['/appointments']);
  }

  /**
   * Los días que se pueden elegir, desde hoy hasta el horizonte del negocio.
   * Un horizonte de 0 no significa "ninguno": significa que no lo ha
   * configurado, así que se usa el mes por defecto.
   */
  private buildDays(horizon: number): void {
    const total = Math.min(horizon > 0 ? horizon : 30, 60);
    const today = new Date();
    this.days = Array.from({ length: total }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }
}

/** El fallo al reservar dicho en cristiano, no con el código HTTP. */
function bookingErrorMessage(error: ApiError): string {
  if (error.networkError) return 'Sin conexión. Comprueba tu red.';
  if (error.isPaymentRequired) return 'Este negocio pide una tarjeta guardada para reservar.';
  if (error.isConflict) return 'Ese horario ya no está disponible. Elige otro.';
  if (error.isUnauthorized) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
  return error.message || 'No se ha podido crear la reserva.';
}
