import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { ToastService } from '../../core/toast.service';
import { WaitlistJoinSheetComponent } from '../../components/waitlist-join-sheet/waitlist-join-sheet.component';
import {
  AvailabilitySlot,
  BookingResponse,
  BusinessResponse,
  WorkerResponse,
  chargesCancellation,
} from '../../models/bipsy.models';
import {
  BookableService,
  BusinessBookingExtras,
  BookingAddress,
  BookingPlace,
  CreateBookingFullRequest,
  CustomerContact,
  addressOneLine,
  hasVenue,
  isAddressReady,
  needsPlaceStep,
  priceFor,
  visitsCustomer,
} from '../../models/booking-extras.models';
import { stripOneLine } from '../../repositories/booking-extras.repository';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { LoginFormComponent } from '../../components/login-form/login-form.component';
import { FlowHeaderComponent } from '../../components/booking-steps/flow-header.component';
import { MonthCalendarComponent } from '../../components/booking-steps/month-calendar.component';
import { SlotGridComponent } from '../../components/booking-steps/slot-grid.component';
import { PaymentRepository } from '../../repositories/payment.repository';
import { BookingRepository } from '../../repositories/booking.repository';
import { PayBookingSheetComponent } from '../../components/pay-booking-sheet/pay-booking-sheet.component';
import { BookingQuote, cents, quoteIsHeld, quoteUsable } from '../../models/payments-extras.models';
import {
  duration,
  euros,
  isoDate,
  isoLocalDateTime,
  longDate,
  parseLocal,
  time,
} from '../../shared/dates';
import { businessIdFromParam, businessPath } from '../../shared/slug';
import { fixImageUrl } from '../../shared/image-url';
import { categoryIcon } from '../../shared/category-icons';
import { primaryCategory } from '../../models/bipsy.models';
import { BookingPlaceStepComponent } from './booking-place-step.component';
import { AttendeeSheetComponent } from './attendee-sheet.component';

/** Los pasos que cuentan en la barra de progreso. */
type FlowStep = 'service' | 'place' | 'worker' | 'date' | 'time' | 'confirm';
type Step = FlowStep | 'auth' | 'done';

/**
 * Tope del cargo por cancelar, en céntimos. Replica
 * `Business.MAX_CANCELLATION_FEE_CENTS`: aquí solo sirve para enseñar el mismo
 * importe que se cobraría; el cálculo bueno es el del servidor.
 */
const MAX_FEE_CENTS = 10_000;

/**
 * Flujo de reserva. Port de `BookingFlowScreen`, sus pasos y `BookingResult`.
 *
 * Los pasos, en el orden de la app: dónde, con quién, qué día, a qué hora y
 * confirmar. Cada uno se salta cuando solo tiene una respuesta —el sitio si el
 * servicio solo se presta en el local, el profesional si solo hay uno—, pero el
 * dato se rellena igual: sin `workerId` el `POST /bookings` falla. Delante va
 * el de elegir servicio, que la app no tiene porque allí se entra desde él;
 * aquí se puede llegar con un enlace al negocio sin servicio elegido.
 *
 * **Elegir es público y entrar va al final.** Los pasos de elegir no piden
 * nada —el catálogo y la disponibilidad son públicos—, y la cuenta se pide ya
 * con la hora elegida. Pedirla antes era un muro: el enlace de un negocio no
 * servía para lo único que importa.
 *
 * Ese paso no tiene formulario propio: monta `app-login-form`, el mismo de
 * `/acceder`. Y se queda DENTRO del flujo para que la hora elegida no se pierda.
 */
@Component({
  selector: 'app-booking-flow',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    AddCardSheetComponent,
    AvatarComponent,
    LoginFormComponent,
    FlowHeaderComponent,
    MonthCalendarComponent,
    SlotGridComponent,
    BookingPlaceStepComponent,
    AttendeeSheetComponent,
    PayBookingSheetComponent,
    WaitlistJoinSheetComponent,
  ],
  templateUrl: './booking-flow.component.html',
  styleUrls: ['./booking-flow.component.css', './booking-confirm.css'],
})
export class BookingFlowComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly bipsy = inject(BipsyService);
  private readonly session = inject(SessionService);
  private readonly toasts = inject(ToastService);
  private readonly payments = inject(PaymentRepository);
  private readonly bookingRepo = inject(BookingRepository);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * Si se llegó aquí navegando dentro de la web.
   *
   * Se mira en la construcción porque `getCurrentNavigation()` solo existe
   * mientras la navegación está en curso: después vale null.
   */
  private readonly cameFromApp =
    this.router.getCurrentNavigation()?.previousNavigation != null;

  step: Step = 'service';
  loading = true;
  submitting = false;
  error: string | null = null;

  business?: BusinessResponse;
  services: BookableService[] = [];
  workers: WorkerResponse[] = [];
  workersLoading = false;

  /** Se entró con el servicio ya elegido: no hay paso de servicio al que volver. */
  private serviceFixed = false;

  service?: BookableService;
  /** Undefined = «Cualquiera disponible». */
  workerId?: number;
  place: BookingPlace | null = null;
  address: BookingAddress | null = null;
  day?: Date;
  slots: AvailabilitySlot[] = [];
  slotsLoading = false;
  slotsError: string | null = null;
  startTime?: string;
  /**
   * Profesionales libres en la hora elegida, tal y como los da la
   * disponibilidad. Solo sirve con «Cualquiera disponible»: el servidor exige
   * un profesional concreto en cuanto hay a quién elegir.
   */
  slotWorkerIds: number[] = [];
  notes = '';
  acceptedPolicy = false;
  /** Para quién es la cita. Null = «Mí», que es lo que vale casi siempre. */
  attendee: CustomerContact | null = null;
  attendeeSheetOpen = false;

  /** La cita ya hecha: la pantalla pasa a enseñar el resultado. */
  booking?: BookingResponse;

  // ----- ENTRAR PARA RESERVAR --------------------

  /** No había sesión al entrar: hará falta pasar por el paso de entrada. */
  needsAuth = false;

  // ----- TARJETA --------------------
  //
  // Un negocio puede exigir tarjeta guardada para aceptar reservas. Si no la
  // hay, el servidor rechaza el POST con 402; se guarda aquí mismo, igual que
  // `AddCardSheet` en la app, en vez de mandar a Ajustes › Pagos a media cita.
  /** null mientras no se sabe: no se puede decidir el botón hasta saberlo. */
  hasCard: boolean | null = null;
  cardSheetOpen = false;
  stripeKey: string | null = null;

  // ----- LISTA DE ESPERA --------------------
  waitlistBusy = false;
  waitlistDone = false;
  /** Pulsó «Avisadme» sin sesión: se apunta en cuanto entre. */
  private pendingWaitlist = false;
  /** La hoja de preferencias de la lista de espera. */
  waitlistSheetOpen = false;

  /** Hoy y el último día que se puede reservar, según el negocio. */
  firstDay = startOfToday();
  lastDay = startOfToday();

  async ngOnInit(): Promise<void> {
    const businessId = businessIdFromParam(this.route.snapshot.paramMap.get('id'));
    const params = this.route.snapshot.queryParams;

    // ⚠️ Hay que ESPERAR a que la sesión se resuelva antes de decidir: al
    // entrar por enlace directo `status` todavía vale 'unknown' aquí, y
    // preguntarlo en seco echaba al login a quien tenía sesión.
    const status = await firstValueFrom(
      this.session.status$.pipe(filter(value => value !== 'unknown'), take(1)),
    );
    this.needsAuth = status !== 'authenticated';

    try {
      const [business, services] = await Promise.all([
        this.bipsy.getBusinessById(businessId!),
        this.bipsy.getBusinessServices(businessId!),
      ]);
      this.business = business;
      this.services = (services as BookableService[]).filter(s => s.active);
      this.buildHorizon();

      // "Volver a reservar" entra con el servicio (y a veces el profesional)
      // de la última cita. Si ese servicio ya no está, se elige a mano.
      const preselected = Number(params['serviceId']);
      const found = this.services.find(s => s.id === preselected);
      if (found) {
        this.serviceFixed = true;
        await this.chooseService(found, Number(params['workerId']) || undefined);
      }
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.loading = false;
    }
  }

  // ----- PASOS Y CABECERA --------------------

  /**
   * Los pasos de esta reserva, en orden. Se calcula con lo elegido: el sitio y
   * el profesional existen o no según el servicio.
   */
  get steps(): FlowStep[] {
    const list: FlowStep[] = [];
    if (!this.serviceFixed) list.push('service');
    if (this.service && needsPlaceStep(this.service)) list.push('place');
    if (this.service && this.showWorkerStep) list.push('worker');
    list.push('date', 'time', 'confirm');
    return list;
  }

  /** Dónde está el paso actual en la lista. Entrar cuenta como confirmar. */
  private get stepIndex(): number {
    const s = this.step === 'auth' || this.step === 'done' ? 'confirm' : this.step;
    return Math.max(0, this.steps.indexOf(s));
  }

  get progress(): number {
    return (this.stepIndex + 1) / this.steps.length;
  }

  get atStart(): boolean {
    return this.stepIndex === 0 && this.step !== 'auth';
  }

  /**
   * El título es la PREGUNTA del paso: quien mira la pantalla sabe qué se
   * espera de él sin leer nada más.
   */
  get stepTitle(): string {
    switch (this.step) {
      case 'service': return '¿Qué te hacemos?';
      case 'place': return '¿Dónde te atendemos?';
      case 'worker': return '¿Con quién?';
      case 'date': return '¿Qué día?';
      case 'time': return '¿A qué hora?';
      case 'auth': return 'Entra para reservar';
      default: return 'Confirma tu reserva';
    }
  }

  private goTo(step: Step): void {
    this.error = null;
    this.step = step;
    // Cada paso empieza arriba: al cambiar de contenido sin cambiar de URL,
    // el navegador deja el scroll donde estaba el paso anterior.
    window.scrollTo({ top: 0 });
  }

  /** El paso siguiente en la lista, o el de entrar si toca. */
  private advanceFrom(step: FlowStep): void {
    const list = this.steps;
    const next = list[list.indexOf(step) + 1];
    if (next === 'confirm' && this.needsAuth) {
      this.goTo('auth');
      return;
    }
    if (next === 'date') {
      this.ensureDay();
    }
    if (next === 'time') {
      void this.loadSlots();
    }
    if (next === 'confirm') {
      this.enterConfirm();
    }
    this.goTo(next ?? 'confirm');
  }

  back(): void {
    if (this.step === 'auth') {
      this.pendingWaitlist = false;
      this.goTo('time');
      return;
    }
    const list = this.steps;
    const i = list.indexOf(this.step as FlowStep);
    if (i > 0) {
      this.goTo(list[i - 1]);
      return;
    }
    // ⚠️ VOLVER, no navegar a la ficha. Navegar EMPUJABA una ficha nueva
    // encima de la reserva, y la ficha vuelve con `location.back()`: se
    // quedaba rebotando entre las dos. Sin historial propio —enlace directo—
    // no hay a dónde volver y ahí sí toca navegar.
    this.exit();
  }

  private exit(): void {
    if (this.cameFromApp) {
      this.location.back();
    } else if (this.business) {
      this.router.navigate(businessPath(this.business));
    }
  }

  // ----- 1. SERVICIO --------------------

  async chooseService(service: BookableService, preselectedWorkerId?: number): Promise<void> {
    const changed = this.service?.id !== service.id;
    this.service = service;
    if (changed) {
      this.workerId = preselectedWorkerId;
      this.place = null;
      this.address = null;
      this.startTime = undefined;
      this.slotWorkerIds = [];
    }

    const workerIds = service.workerIds ?? [];
    if (workerIds.length === 1) {
      // Con un solo profesional no hay nada que elegir, pero el id hace falta
      // igual: sin él el POST falla por `workerId` nulo.
      this.workerId = workerIds[0];
    }
    if (this.showWorkerStep) {
      void this.loadWorkers();
    }

    // Con profesional ya elegido —"volver a reservar"— se arranca en la fecha,
    // salvo que haya que decidir el sitio: la dirección no viene con él y sin
    // ella la reserva moriría en el último paso con un 400.
    if (this.serviceFixed && preselectedWorkerId && !needsPlaceStep(service)) {
      this.ensureDay();
      this.goTo('date');
      return;
    }
    if (this.serviceFixed) {
      this.goTo(this.steps[0]);
      if (this.step === 'date') this.ensureDay();
      return;
    }
    this.advanceFrom('service');
  }

  // ----- 2. SITIO --------------------

  onPlaceChange(place: BookingPlace): void {
    this.place = place;
  }

  onAddressChange(address: BookingAddress | null): void {
    this.address = address;
  }

  onPlaceNext(): void {
    this.advanceFrom('place');
  }

  /** Dónde se atiende de verdad: lo elegido, o lo único posible. */
  get placeForBooking(): BookingPlace {
    if (this.place) return this.place;
    return visitsCustomer(this.service) && !hasVenue(this.service) ? 'AT_CUSTOMER' : 'AT_BUSINESS';
  }

  // ----- 3. PROFESIONAL --------------------

  get showWorkerStep(): boolean {
    return !this.business?.autonomous && (this.service?.workerIds?.length ?? 0) > 1;
  }

  /** Solo los que prestan ESTE servicio. */
  get eligibleWorkers(): WorkerResponse[] {
    const ids = this.service?.workerIds ?? [];
    const matching = this.workers.filter(w => ids.includes(w.id));
    return matching.length > 0 ? matching : this.workers;
  }

  private async loadWorkers(): Promise<void> {
    if (this.workers.length > 0 || !this.business || this.workersLoading) {
      return;
    }
    this.workersLoading = true;
    try {
      this.workers = await this.bipsy.getBusinessWorkers(this.business.id);
    } catch {
      // Sin la lista se sigue con «Cualquiera disponible»: peor sería quedarse
      // sin poder reservar.
      this.workers = [];
    } finally {
      this.workersLoading = false;
    }
  }

  /**
   * Elegir MARCA, y el paso lo da «Siguiente». Avanzar en el mismo clic no
   * dejaba ver qué se había elegido (lo cuenta `StepWorker` en la app).
   */
  chooseWorker(workerId?: number): void {
    if (this.workerId !== workerId) {
      this.startTime = undefined;
      this.slotWorkerIds = [];
    }
    this.workerId = workerId;
  }

  onWorkerNext(): void {
    this.advanceFrom('worker');
  }

  // ----- 4. DÍA --------------------

  /**
   * Sin día elegido queda elegido HOY: un calendario con hoy resaltado y el
   * botón de seguir apagado decía dos cosas distintas a la vez.
   */
  private ensureDay(): void {
    if (!this.day) {
      this.day = new Date(this.firstDay);
    }
  }

  chooseDay(day: Date): void {
    if (this.day && day.getTime() === this.day.getTime()) {
      return;
    }
    this.day = day;
    this.startTime = undefined;
    this.slotWorkerIds = [];
    this.waitlistDone = false;
  }

  onDateNext(): void {
    this.advanceFrom('date');
  }

  get horizonDays(): number {
    return this.business?.availabilityHorizonDays || 30;
  }

  // ----- 5. HORA --------------------

  async loadSlots(): Promise<void> {
    if (!this.service || !this.day) {
      return;
    }
    // Cada carga lleva su número: si se vuelve atrás y se elige otro día antes
    // de que llegue la respuesta, la lenta del día anterior no debe pisar a la
    // buena y enseñar horas de un día que ya no es el elegido.
    const seq = ++this.slotsSeq;
    this.slotsLoading = true;
    this.slotsError = null;
    this.slots = [];
    try {
      const res = await this.bipsy.getAvailability(this.service.id, isoDate(this.day), this.workerId);
      if (seq !== this.slotsSeq) return;
      this.slots = res.slots ?? [];
    } catch (raw) {
      if (seq !== this.slotsSeq) return;
      this.slotsError = ApiError.from(raw).message;
      this.slots = [];
    } finally {
      if (seq === this.slotsSeq) this.slotsLoading = false;
    }
  }

  private slotsSeq = 0;

  /** Sin ninguna hora libre no hay «Siguiente» que ofrecer: mandan las salidas del vacío. */
  get hasFreeSlots(): boolean {
    return this.slots.some(s => s.available);
  }

  chooseSlot(slot: AvailabilitySlot): void {
    this.startTime = slot.start;
    this.slotWorkerIds = slot.availableWorkerIds ?? [];
  }

  onTimeNext(): void {
    if (this.startTime) {
      this.advanceFrom('time');
    }
  }

  changeDay(): void {
    this.goTo('date');
  }

  get canJoinWaitlist(): boolean {
    return !!this.business?.waitlistEnabled && !!this.service;
  }

  /**
   * Apuntarse a la lista de espera: abre la hoja de preferencias
   * (`app-waitlist-join-sheet`). Sin sesión se pide entrar primero y la hoja
   * se abre al volver, sin repetir el clic.
   */
  async joinWaitlist(): Promise<void> {
    if (!this.service || this.waitlistBusy) {
      return;
    }
    if (this.needsAuth) {
      this.pendingWaitlist = true;
      this.goTo('auth');
      return;
    }
    // Las preferencias (días, franjas, con quién, nota) se piden en la hoja,
    // con valores por defecto que ya sirven. Antes se apuntaba en seco del día
    // elegido a una semana después, sin dejar afinar nada.
    this.error = null;
    this.waitlistSheetOpen = true;
  }

  /**
   * Ya está en la lista. Como en la app, se cierra el flujo —aquí no queda
   * nada que hacer— y se dice en un aviso. Quien cierra la hoja sin apuntarse
   * se queda donde estaba.
   */
  onWaitlistJoined(): void {
    this.waitlistSheetOpen = false;
    this.toasts.success('Estás en la lista de espera. Te avisamos si se libera un hueco.');
    this.exit();
  }

  // ----- ENTRAR PARA RESERVAR --------------------

  /** A dónde volver si acaba creando cuenta: a esta misma reserva. */
  get returnToHere(): string {
    return this.router.url;
  }

  /**
   * Ya hay sesión. Entrar no recarga la página, así que lo elegido sigue ahí
   * y se sigue en el resumen —o en las horas, si venía a apuntarse—.
   */
  onSignedIn(): void {
    this.needsAuth = false;
    if (this.pendingWaitlist) {
      this.pendingWaitlist = false;
      this.goTo('time');
      void this.joinWaitlist();
      return;
    }
    this.enterConfirm();
    this.goTo('confirm');
  }

  // ----- 6. CONFIRMAR --------------------

  private enterConfirm(): void {
    // Se mira al llegar aquí y no antes: solo hace falta aquí.
    void this.checkCard();
    // El nombre de quien atiende, aunque el paso de profesional se saltara.
    if (this.hasTeam) {
      void this.loadWorkers();
    }
  }

  /**
   * El profesional con el que se manda la reserva: el elegido o, con
   * «Cualquiera disponible», el primero libre en esa hora.
   */
  get workerIdForBooking(): number | undefined {
    return this.workerId ?? this.slotWorkerIds[0];
  }

  /** Lo ha puesto el sistema y no el cliente: hay que decírselo. */
  get workerWasAutoAssigned(): boolean {
    return this.workerId === undefined && this.workerIdForBooking !== undefined;
  }

  /**
   * Hay equipo y por tanto profesional que resumir. En un negocio de una sola
   * persona la fila diría el nombre del propio negocio. Sin el campo —backend
   * anterior— se cae a `autonomous`.
   */
  get hasTeam(): boolean {
    const team = (this.business as (BusinessResponse & BusinessBookingExtras) | undefined)?.teamEnabled;
    return team ?? !this.business?.autonomous;
  }

  get workerName(): string {
    const id = this.workerIdForBooking;
    if (id === undefined) {
      return 'Cualquiera disponible';
    }
    return this.workers.find(w => w.id === id)?.name ?? `Profesional #${id}`;
  }

  get chargesHomeSurcharge(): boolean {
    return this.placeForBooking === 'AT_CUSTOMER' && (this.service?.homeSurchargeCents ?? 0) > 0;
  }

  get totalPrice(): number {
    return this.service ? priceFor(this.service, this.placeForBooking) : 0;
  }

  get whereLabel(): string {
    return this.placeForBooking === 'AT_CUSTOMER'
      ? (addressOneLine(this.address) || 'A domicilio')
      : 'En el local';
  }

  get timeLabel(): string {
    return this.service ? `${this.startTime ?? '—'} · ${duration(this.service.duration)}` : '';
  }

  get needsPolicyAcceptance(): boolean {
    return !!this.business && chargesCancellation(this.business);
  }

  /**
   * Lo que costaría cancelar tarde, ya calculado: al cliente le importa
   * cuánto, no el porcentaje. Sobre el precio CON desplazamiento, que es el
   * que congela el servidor y sobre el que cobra.
   */
  get feeLabel(): string {
    const percent = this.business?.cancellationFeePercent ?? 0;
    const cents = Math.round(this.totalPrice * percent);
    return euros(Math.min(cents, MAX_FEE_CENTS) / 100);
  }

  openAttendeeSheet(): void {
    if (!this.submitting) {
      this.attendeeSheetOpen = true;
    }
  }

  onAttendeePicked(contact: CustomerContact | null): void {
    this.attendee = contact;
    this.attendeeSheetOpen = false;
  }

  /**
   * ¿Hay tarjeta guardada? Solo se pregunta si el negocio la exige.
   *
   * Si la consulta falla se deja en `false`: el botón dirá «Añadir tarjeta y
   * continuar», que como mucho enseña una hoja de más. Suponer que sí llevaría
   * a un 402 al confirmar.
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

  get needsCard(): boolean {
    return !!this.business?.requiresCard && this.hasCard === false;
  }

  get confirmLabel(): string {
    return this.needsCard ? 'Añadir tarjeta y continuar' : 'Confirmar reserva';
  }

  get confirmIcon(): string {
    return this.needsCard ? 'credit_card' : 'check_circle';
  }

  /**
   * Sin aceptar la política no se deja confirmar: es más honesto que dejar
   * pulsar y devolver un error por algo que está a la vista.
   */
  get confirmBlocked(): boolean {
    return this.needsPolicyAcceptance && !this.acceptedPolicy && !this.needsCard;
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
      // `eventCoalescing` (app.config) deja la detección de cambios del clic
      // para el siguiente fotograma, y este setTimeout llega antes: el `@if`
      // aún no había pintado la hoja, `cardSheet` era undefined y salía «No
      // hemos podido abrir la pasarela de pago». Se pinta aquí, a la fuerza.
      this.cdr.detectChanges();
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
    const atCustomer = this.placeForBooking === 'AT_CUSTOMER';
    if (atCustomer && !isAddressReady(this.address)) {
      this.error = 'Falta la dirección: vuelve al primer paso y dinos a dónde ir.';
      return;
    }

    this.submitting = true;
    this.error = null;
    const req: CreateBookingFullRequest = {
      serviceId: this.service.id,
      workerId: this.workerIdForBooking,
      startDateTime: isoLocalDateTime(this.day, this.startTime),
      notes: this.notes.trim() || undefined,
      acceptedPolicy: this.acceptedPolicy,
      // El sitio solo viaja si el servicio deja elegir o va a casa; si no, el
      // servidor lo deduce y mandarlo no añade nada.
      servicePlace: needsPlaceStep(this.service) ? this.placeForBooking : undefined,
      address: atCustomer && this.address ? stripOneLine(this.address) : undefined,
      attendeeContactId: this.attendee?.id,
    };
    try {
      const booking = await this.bipsy.createBooking(req);
      // El pago va DESPUÉS de crear la cita porque hace falta su id para
      // cobrar. Con el negocio en modo obligatorio eso abre una ventana: una
      // cita reservada y sin pagar. Se cierra aquí mismo —o paga, o se cancela
      // ahora— en vez de dejársela al job, que tardaría 15 minutos y el cliente
      // no entendería por qué se le ha caído la cita.
      if (!(await this.chargeIfRequired(booking))) {
        return;
      }
      this.booking = booking;
      this.step = 'done';
      window.scrollTo({ top: 0 });
      void this.loadResultQuote();
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

  // ----- PAGO DE LA CITA --------------------

  /** La hoja de pago abierta, con lo que necesita. Null si no hay ninguna. */
  paySheet: { quote: BookingQuote; concept: string; retiene: boolean } | null = null;
  private payResolve?: (paid: boolean) => void;

  /** Lo que queda por pagar de la cita recién hecha, para el resultado. */
  resultQuote: BookingQuote | null = null;

  /** Abre la hoja de pago y resuelve si el dinero llegó a salir. */
  private openPaySheet(quote: BookingQuote, retiene: boolean): Promise<boolean> {
    return new Promise(resolve => {
      this.payResolve = resolve;
      this.paySheet = {
        quote,
        concept: this.service?.name ?? this.booking?.serviceName ?? 'Cita',
        retiene,
      };
    });
  }

  onPaySheetClosed(paid: boolean): void {
    this.paySheet = null;
    const resolve = this.payResolve;
    this.payResolve = undefined;
    resolve?.(paid);
  }

  /**
   * Cobra la cita si el negocio no admite tenerla sin pagar.
   *
   * Devuelve false si la cita ya no existe —no pagó y se ha cancelado—, y
   * entonces no se sigue al resultado: enseñar «Reserva confirmada» de algo que
   * acabamos de cancelar sería mentirle.
   *
   * Con la cita por aceptar el dinero se RETIENE en vez de cobrarse; de eso se
   * encarga el servidor, aquí solo cambia lo que se le dice. En modo opcional
   * no hace nada: pagar se ofrece en el resultado, sin bloquear.
   */
  private async chargeIfRequired(booking: BookingResponse): Promise<boolean> {
    let quote: BookingQuote;
    try {
      quote = await this.payments.bookingQuote(booking.id);
    } catch {
      // Si no se puede ni preguntar, se sigue: la cita está hecha y podrá
      // pagarla desde su ficha. El servidor la cancelará si no lo hace.
      return true;
    }
    if (!quote.required || !quoteUsable(quote)) {
      return true;
    }

    const paid = await this.openPaySheet(quote, booking.status === 'PENDING');
    if (paid) {
      return true;
    }

    // No pagó: se suelta el hueco en el momento y se le dice por qué.
    try {
      await this.bookingRepo.cancel(booking.id);
    } catch {
      // Si falla, lo hará el job en 15 minutos. No se le cuenta: para él la
      // cita no ha llegado a existir.
    }
    this.error = 'Este negocio necesita el pago para guardar la cita. No se ha completado, '
      + 'así que la hora vuelve a estar libre.';
    return false;
  }

  /** Se pide de nuevo al llegar al resultado: si acaba de pagar, ya no debe nada. */
  private async loadResultQuote(): Promise<void> {
    if (!this.booking) return;
    try {
      this.resultQuote = await this.payments.bookingQuote(this.booking.id);
    } catch {
      this.resultQuote = null;
    }
  }

  /**
   * Pagar desde el resultado. Con la cita aún por aceptar no se ofrece: el
   * texto de arriba acaba de decirle que se lo pediremos cuando el negocio la
   * acepte, y un botón de pagar justo debajo lo desmentiría.
   */
  get canPayFromResult(): boolean {
    return quoteUsable(this.resultQuote) && this.resultQuote.dueCents > 0 && !this.resultPending;
  }

  get resultPayLabel(): string {
    return `Pagar ${cents(this.resultQuote?.dueCents)}`;
  }

  /** El importe ya reservado: hay que decirlo o buscará un cargo que no existe. */
  get resultHeld(): boolean {
    return this.resultPending && quoteIsHeld(this.resultQuote);
  }

  async payFromResult(): Promise<void> {
    if (!this.resultQuote || this.paySheet) return;
    await this.openPaySheet(this.resultQuote, false);
    await this.loadResultQuote();
  }

  // ----- RESULTADO --------------------

  /** Pendiente de que el negocio la acepte. */
  get resultPending(): boolean {
    return this.booking?.status === 'PENDING';
  }

  get resultDay(): string {
    return this.booking ? longDate(parseLocal(this.booking.startDateTime)) : '';
  }

  get resultTime(): string {
    return this.booking ? time(parseLocal(this.booking.startDateTime)) : '';
  }

  goToBookings(): void {
    this.router.navigate(['/citas']);
  }

  /** «Hecho»: de vuelta a la ficha del negocio, que es de donde se vino. */
  done(): void {
    this.exit();
  }

  // ----- VISTA --------------------

  get dayLabel(): string {
    return this.day ? longDate(this.day) : '';
  }

  price(service: BookableService): string {
    return euros(service.price);
  }

  durationLabel(service: BookableService): string {
    return duration(service.duration);
  }

  money(value: number): string {
    return euros(value);
  }

  /** La foto del servicio, como en la tarjeta de servicio de la ficha de la app. */
  serviceImage(service: BookableService): string | null {
    return fixImageUrl(service.imageUrl);
  }

  /** Sin foto, el icono de la categoría del negocio, como en la ficha. */
  get categoryIconName(): string {
    return categoryIcon(this.business ? primaryCategory(this.business)?.code : null);
  }

  /** Portada del negocio para el resumen lateral del escritorio. */
  get coverUrl(): string | null {
    return fixImageUrl(this.business?.coverImageUrl);
  }

  /**
   * El profesional en el resumen lateral, solo cuando hay a quién elegir y ya
   * se ha pasado por ese paso: antes de elegir, «Cualquiera disponible» se
   * leería como una decisión tomada por el cliente.
   */
  get asideWorker(): string | null {
    if (!this.hasTeam || !this.showWorkerStep) return null;
    return this.steps.indexOf('worker') < this.stepIndexForAside ? this.workerName : null;
  }

  /** El paso actual contado como en la barra; para saber qué ya está elegido. */
  get stepIndexForAside(): number {
    const s = this.step === 'auth' || this.step === 'done' ? 'confirm' : this.step;
    return Math.max(0, this.steps.indexOf(s));
  }

  /**
   * Desde hoy hasta el horizonte del negocio. Un horizonte de 0 no significa
   * "ninguno": significa que no lo ha configurado, y se usa el mes por defecto.
   */
  private buildHorizon(): void {
    const today = startOfToday();
    const last = new Date(today);
    last.setDate(today.getDate() + this.horizonDays - 1);
    this.firstDay = today;
    this.lastDay = last;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** El fallo al reservar dicho en cristiano, no con el código HTTP. */
function bookingErrorMessage(error: ApiError): string {
  if (error.networkError) return 'Sin conexión. Comprueba tu red.';
  // El 401 es el único donde el texto del servidor no ayuda: dice que falta un
  // token, y lo que el cliente necesita saber es que vuelva a entrar.
  if (error.isUnauthorized) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';

  // ⚠️ El mensaje del SERVIDOR manda cuando lo hay: sabe qué ha pasado, y un
  // 409 ya no es solo «hueco ocupado». Esta función solo pone palabras donde
  // no las hay.
  if (error.message?.trim()) return error.message;

  if (error.isPaymentRequired) return 'Este negocio pide una tarjeta guardada para reservar.';
  if (error.isConflict) return 'Ese horario ya no está disponible. Elige otro.';
  return 'No se ha podido crear la reserva.';
}
