import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
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
  GuestBookingResponse,
  ServiceResponse,
  WorkerResponse,
  chargesCancellation,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { PaymentRepository } from '../../repositories/payment.repository';
import { GuestBookingRepository } from '../../repositories/guest-booking.repository';
import { isValidEmail, isValidPhone } from '../../shared/validation';
import { euros, isoDate, isoLocalDateTime, longDate, duration, relativeDate } from '../../shared/dates';
import { businessIdFromParam, businessPath } from '../../shared/slug';

type Step = 'service' | 'worker' | 'date' | 'time' | 'guest' | 'confirm' | 'done';

/**
 * Flujo de reserva. Port de `BookingFlowScreen` y sus cuatro pasos.
 *
 * El paso de profesional se salta cuando no hay nada que elegir —negocio
 * autónomo, o un servicio con un solo profesional—, pero el `workerId` se
 * rellena igualmente: sin él el `POST /bookings` falla.
 *
 * **Sirve con sesión y sin ella**, y es el mismo flujo: los cuatro pasos de
 * elegir son idénticos porque el catálogo y la disponibilidad son públicos. Sin
 * sesión se añade un paso de datos —nombre, correo y teléfono— y el `POST` va a
 * `/public/bookings`. Esto antes era un muro: se echaba al login antes de cargar
 * nada, y quien entraba desde el enlace de un negocio tenía que crearse una
 * cuenta para pedir hora.
 *
 * Lo que de verdad cambia sin cuenta son dos cosas, y las dos se ven abajo:
 *
 *  - **La tarjeta no está guardada en ninguna parte.** Si el negocio la exige,
 *    hay que pedirla en el momento y antes de crear la cita, con el token que
 *    devuelve `prepareCard`.
 *  - **La cita no va a «Mis citas»**, porque no hay cuenta a la que colgarla. Su
 *    sitio es `/cita/:token`, y ese enlace llega por correo.
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
  private readonly guest = inject(GuestBookingRepository);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * Si se llegó aquí navegando dentro de la web.
   *
   * Se mira en la construcción porque `getCurrentNavigation()` solo existe
   * mientras la navegación está en curso: después vale null y ya no hay forma
   * de saber si había algo detrás.
   */
  private readonly cameFromApp =
    this.router.getCurrentNavigation()?.previousNavigation != null;

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

  // ----- SIN CUENTA --------------------
  //
  // Se decide una vez al cargar, cuando la sesión ya está resuelta, y no se
  // vuelve a preguntar: a mitad de una reserva nadie inicia sesión, y si lo
  // hiciera en otra pestaña, cambiar de camino aquí perdería los datos que
  // lleva escritos.
  /** Reserva sin cuenta: no había sesión al entrar. */
  isGuest = false;

  guestName = '';
  guestEmail = '';
  guestPhone = '';

  /** Token firmado de la tarjeta (15 min) y la tarjeta ya confirmada. */
  private guestCardToken?: string;
  private guestPaymentMethodId?: string;
  /** Secreto del SetupIntent público. Se pide una vez y se reutiliza. */
  guestCardSecret: string | null = null;

  /** La cita creada sin cuenta. Es de donde sale el enlace para volver a ella. */
  guestBooking?: GuestBookingResponse;

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
    // Sin sesión NO se echa al login. Antes sí, y era el muro que dejaba el
    // enlace público de un negocio sin servir para lo único que importa: pedir
    // hora. Lo que se hace es tomar el otro camino, que son los mismos pasos
    // más uno de datos.
    this.isGuest = status !== 'authenticated';

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
    // Sin cuenta hay un paso más antes del resumen: quién reserva. Va DESPUÉS de
    // elegir hora, no antes, por lo mismo que la tarjeta en la app: pedir datos
    // a quien todavía no sabe si hay hueco es perder gente por nada.
    this.step = this.isGuest ? 'guest' : 'confirm';
    // Se mira al entrar en el resumen y no antes: solo hace falta aquí, y
    // preguntarlo en cada paso serían tres llamadas para nada.
    if (!this.isGuest) {
      void this.checkCard();
    }
  }

  // ----- SIN CUENTA --------------------

  /** Lo que falta por rellenar en el paso de datos, o null si está completo. */
  get guestFormError(): string | null {
    if (this.guestName.trim().length < 2) return 'Dinos cómo te llamas.';
    if (!isValidEmail(this.guestEmail.trim())) return 'Ese correo no parece válido.';
    if (!isValidPhone(this.guestPhone)) return 'Ese teléfono no parece válido.';
    return null;
  }

  get guestFormComplete(): boolean {
    return this.guestFormError === null;
  }

  /** Del paso de datos al resumen. */
  continueAsGuest(): void {
    const problema = this.guestFormError;
    if (problema) {
      this.error = problema;
      return;
    }
    this.error = null;
    this.step = 'confirm';
    // La tarjeta se mira ahora, con el correo ya escrito: el endpoint que
    // prepara el intent lo necesita.
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
    // Sin cuenta no hay tarjeta guardada que buscar: o la pone ahora o no
    // reserva. Y la clave publicable llega con el intent, en `prepareCard`, así
    // que aquí no hace falta pedir nada.
    if (this.isGuest) {
      this.hasCard = !!this.guestPaymentMethodId;
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
    if (!this.business?.requiresCard) return false;
    // Sin cuenta la tarjeta no puede estar ya guardada: hace falta hasta que la
    // pone en esta misma pantalla.
    if (this.isGuest) return !this.guestPaymentMethodId;
    return this.hasCard === false;
  }

  /** El botón del resumen cambia de texto y de acción según falte o no. */
  get confirmLabel(): string {
    return this.needsCard ? 'Añadir tarjeta y continuar' : 'Confirmar reserva';
  }

  get confirmIcon(): string {
    return this.needsCard ? 'credit_card' : 'check_circle';
  }

  async openCardSheet(): Promise<void> {
    // Sin cuenta hay que pedir el intent antes de abrir la hoja: de ahí salen el
    // secreto, la clave publicable y el token firmado que hay que devolver al
    // reservar. Y va ANTES de crear la cita a propósito: si fuera después, quien
    // no termina de poner la tarjeta le dejaría al negocio una cita sin la
    // garantía con la que la habría aceptado.
    if (this.isGuest && !this.guestCardSecret) {
      if (!this.service) return;
      this.submitting = true;
      this.error = null;
      try {
        const setup = await this.guest.prepareCard({
          serviceId: this.service.id,
          name: this.guestName.trim(),
          email: this.guestEmail.trim(),
        });
        this.guestCardSecret = setup.clientSecret;
        this.guestCardToken = setup.cardToken;
        this.stripeKey = setup.publishableKey;
      } catch (raw) {
        this.error = ApiError.from(raw).message;
        return;
      } finally {
        this.submitting = false;
      }
    }

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

  /**
   * Lo mismo sin cuenta: la tarjeta queda confirmada en Stripe y la cuelga de
   * su ficha el POST de la reserva, que es lo único que sabe a quién.
   */
  onGuestCardConfirmed(paymentMethodId: string): void {
    this.cardSheetOpen = false;
    this.guestPaymentMethodId = paymentMethodId;
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
      if (this.isGuest) {
        const booking = await this.guest.createBooking({
          serviceId: this.service.id,
          workerId: this.workerId,
          startDateTime: isoLocalDateTime(this.day, this.startTime),
          notes: this.notes.trim() || undefined,
          acceptedPolicy: this.acceptedPolicy,
          name: this.guestName.trim(),
          email: this.guestEmail.trim(),
          phone: this.guestPhone.trim(),
          cardToken: this.guestCardToken,
          paymentMethodId: this.guestPaymentMethodId,
        });
        this.guestBooking = booking;
        this.bookingId = booking.bookingId;
        this.step = 'done';
        return;
      }
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
      case 'guest': this.step = 'time'; break;
      case 'confirm': this.step = this.isGuest ? 'guest' : 'time'; break;
      default:
        // ⚠️ VOLVER, no navegar a la ficha.
        //
        // Navegar EMPUJABA una ficha nueva encima de la reserva, y la ficha
        // vuelve con `location.back()`: se quedaba rebotando entre las dos
        // para siempre. Con historial propio se retrocede de verdad; sin él
        // —entrando por enlace directo— no hay a dónde volver y ahí sí toca
        // navegar, o se saldría del sitio.
        if (this.cameFromApp) {
          this.location.back();
        } else if (this.business) {
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
    // Sin cuenta su cita no está en «Mis citas», porque no hay cuenta a la que
    // colgarla: su sitio es la página del token, que es también la del enlace
    // que le llega por correo.
    if (this.guestBooking?.token) {
      this.router.navigate(['/cita', this.guestBooking.token]);
      return;
    }
    this.router.navigate(['/citas']);
  }

  /**
   * «Crear cuenta» desde el final de una reserva sin cuenta.
   *
   * Lleva el correo y el nombre ya puestos, que es lo que convierte un alta en
   * dos campos. ⚠️ La cita que acaba de hacer NO se mueve a la cuenta nueva: su
   * titular es la ficha del negocio y nada reescribe eso hoy. Se le dice en la
   * pantalla, en vez de dejar que lo descubra buscándola en Mis citas.
   */
  createAccount(): void {
    this.router.navigate(['/crear-cuenta'], {
      queryParams: { email: this.guestEmail.trim(), name: this.guestName.trim() },
    });
  }

  /** El texto del final, que no es el mismo si el negocio acepta a mano. */
  get doneTitle(): string {
    if (this.guestBooking) {
      return this.guestBooking.status === 'PENDING' ? 'Cita solicitada' : 'Cita confirmada';
    }
    return 'Reserva enviada';
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
