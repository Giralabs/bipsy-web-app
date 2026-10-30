import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { BreakpointService } from '../../core/breakpoint.service';
import { DialogService } from '../../core/dialog.service';
import { SessionService } from '../../core/session.service';
import { WaitlistRepository } from '../../repositories/waitlist.repository';
import { PaymentRepository } from '../../repositories/payment.repository';
import { isOfferOpen } from '../../models/bipsy.models';
import { AcceptOfferRequest, WaitlistOfferDetail } from '../../models/confirm.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { DeadlineCountdownComponent } from '../../components/deadline-countdown/deadline-countdown.component';
import { AddressPickerComponent } from '../../components/address-picker/address-picker.component';
import { BookingAddress, isAddressReady } from '../../models/booking-extras.models';
import { ServiceArea, outOfServiceArea } from '../../models/address-picker.models';
import { stripOneLine } from '../../repositories/booking-extras.repository';
import { euros, longDate, parseLocal, time } from '../../shared/dates';

interface Closed {
  title: string;
  message: string;
}

/**
 * El aviso de hueco libre: lo que ve el cliente al abrir la notificación o el
 * correo. Port de `WaitlistOfferScreen`.
 *
 * Es la pantalla donde se decide si la lista de espera sirve de algo, y por
 * eso lo enseña TODO de una vez: qué hueco es, cuánto queda para contestar, lo
 * que cuesta y lo que se acepta al quedárselo. Cualquier cosa que obligue a
 * salir de aquí para decidir es un hueco que se pierde.
 *
 * El hueco NO está reservado mientras se piensa. Si alguien lo coge antes, el
 * servidor responde 409 y aquí se dice con todas las letras en vez de dejar
 * un error genérico.
 */
@Component({
  selector: 'app-waitlist-offer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    AddCardSheetComponent,
    DeadlineCountdownComponent,
    AddressPickerComponent,
  ],
  templateUrl: './waitlist-offer.component.html',
  // El armazón es el de la cita que te da el negocio: en la app son la misma
  // pantalla, y así no se separan.
  styleUrls: ['../booking-confirm/confirm-shell.css', './waitlist-offer.component.css'],
})
export class WaitlistOfferComponent implements OnInit {
  /** Los datos van en la lista (móvil) o en la tarjeta lateral (escritorio). */
  readonly desktop = inject(BreakpointService).desktop;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly waitlist = inject(WaitlistRepository);
  private readonly payments = inject(PaymentRepository);
  private readonly dialog = inject(DialogService);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;

  offer?: WaitlistOfferDetail;
  isLoading = true;
  loadError: ApiError | null = null;

  acceptedPolicy = false;
  sending = false;
  error: string | null = null;

  // ----- DIRECCIÓN --------------------
  //
  // El hueco es de un servicio a domicilio: hay que decir a dónde ir o aceptar
  // respondería 400. Se pide AQUÍ y no al apuntarse porque una dirección
  // guardada hace semanas lleva todo ese tiempo caducando. La libreta primero
  // (con la predeterminada ya marcada): el hueco caduca mientras se teclea, y
  // elegir en un clic es la diferencia entre quedárselo y perderlo.
  address: BookingAddress | null = null;
  @ViewChild(AddressPickerComponent) picker?: AddressPickerComponent;

  // ----- TARJETA --------------------
  //
  // Si el negocio pide tarjeta y este cliente no tiene ninguna, se ofrece
  // ponerla AQUÍ. Sin esto, aceptar respondería 402 y habría que ir a Pagos a
  // buscarla: con el plazo corriendo, ese viaje es el hueco perdido.
  /** null mientras no se sabe: se deja el botón normal, el servidor rechaza igual. */
  hasCard: boolean | null = null;
  stripeKey: string | null = null;
  cardSheetOpen = false;

  private get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async ngOnInit(): Promise<void> {
    if (!this.session.isAuthenticated && !this.session.tokenLooksPresent) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    await this.load();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      this.offer = await this.waitlist.offer(this.id);
    } catch (raw) {
      this.loadError = ApiError.from(raw);
      return;
    } finally {
      this.isLoading = false;
    }
    if (this.isOpen && this.offer.requiresCard) {
      void this.checkCard();
    }
  }

  // ----- VISTA --------------------

  /** Pendiente y con plazo: el estado solo no basta, el servidor cierra con retraso. */
  get isOpen(): boolean {
    return !!this.offer && isOfferOpen(this.offer);
  }

  /**
   * El aviso ya no vale: caducado, contestado o el hueco se lo quedó otro.
   *
   * Se distingue el motivo porque no son lo mismo para quien lo lee: que se lo
   * hayan quitado no es culpa suya y conviene decirlo, o parecerá que la lista
   * funciona mal.
   */
  get closed(): Closed {
    switch (this.offer?.status) {
      case 'ACCEPTED':
        return { title: 'Ya es tuyo', message: 'Cogiste este hueco. Lo tienes en Mis citas.' };
      case 'DECLINED':
        return { title: 'Lo rechazaste', message: 'Este hueco se ofreció a otra persona de la lista.' };
      case 'LOST':
        return {
          title: 'Alguien llegó antes',
          message: 'Este hueco ya lo ha cogido otra persona. Sigues en la lista de espera para el siguiente.',
        };
      default:
        return {
          title: 'Se pasó el plazo',
          message: 'Este aviso ha caducado y el hueco ha pasado al siguiente de la lista.',
        };
    }
  }

  get dayLabel(): string {
    return this.offer ? longDate(parseLocal(this.offer.slotStart)) : '';
  }

  get timeLabel(): string {
    if (!this.offer) return '';
    return `${time(parseLocal(this.offer.slotStart))} – ${time(parseLocal(this.offer.slotEnd))}`;
  }

  get priceLabel(): string | null {
    const cents = this.offer?.priceCents;
    return typeof cents === 'number' ? euros(cents / 100) : null;
  }

  get needsPolicy(): boolean {
    return !!this.offer?.requiresPolicyConsent && !!this.offer.policyText;
  }

  get needsAddress(): boolean {
    return !!this.offer?.requiresAddress;
  }

  get needsCard(): boolean {
    return !!this.offer?.requiresCard && this.hasCard === false;
  }

  private get addressReady(): boolean {
    return isAddressReady(this.address);
  }

  /** La zona del negocio viaja con el aviso, con los mismos nombres que en su ficha. */
  get area(): ServiceArea | null {
    return this.offer ?? null;
  }

  /**
   * Fuera de la zona del negocio: aquí SÍ se bloquea, al revés que al reservar.
   * Allí forzar cuesta un error y se sigue; aquí el plazo corre mientras tanto,
   * y dejar pulsar solo lo gastaría en un 400 seguro. Sin coordenadas (escrita
   * a mano) no se puede medir y el servidor tampoco rechaza nada.
   */
  get outOfArea(): boolean {
    return this.needsAddress && outOfServiceArea(this.area, this.address);
  }

  /** Con la tarjeta pendiente el botón sí se puede pulsar: lleva a ponerla. */
  get canAccept(): boolean {
    if (this.sending) return false;
    if (this.needsCard) return true;
    return (!this.offer?.requiresPolicyConsent || this.acceptedPolicy)
      && (!this.needsAddress || (this.addressReady && !this.outOfArea));
  }

  // ----- ACCIONES --------------------

  goBack(): void {
    this.location.back();
  }

  goToBookings(): void {
    this.router.navigate(['/citas']);
  }

  openBooking(): void {
    if (this.offer?.bookingId) {
      this.router.navigate(['/citas', this.offer.bookingId]);
    }
  }

  /** Se acabó el plazo con la pantalla abierta: se recarga en vez de dejar botones muertos. */
  onExpired(): void {
    void this.load();
  }

  acceptOrAddCard(): void {
    if (this.needsCard) {
      void this.openCardSheet();
      return;
    }
    void this.accept();
  }

  async accept(): Promise<void> {
    if (!this.offer || this.sending) return;
    const req: AcceptOfferRequest = { acceptedPolicy: this.acceptedPolicy };
    // El sitio y la dirección van solo cuando hacen falta: en un servicio que
    // solo se presta en el local, mandarlos sería decirle al servidor algo que
    // ya sabe.
    if (this.needsAddress && this.address) {
      req.servicePlace = 'AT_CUSTOMER';
      // Calle y ciudad ya están: `canAccept` no deja llegar aquí sin ellas.
      const { address, city, ...rest } = stripOneLine(this.address);
      req.address = { ...rest, address: address ?? '', city: city ?? '' };
    }

    this.sending = true;
    this.error = null;
    try {
      // Guardarla en la libreta va antes y nunca bloquea: si falla, el hueco
      // sigue siendo lo que importa.
      if (this.needsAddress) {
        await this.picker?.persistIfAsked();
      }
      const result = await this.waitlist.acceptOfferWith(this.offer.id, req);
      // A la cita directamente: es lo que se quiere ver después de quedárselo,
      // y lo que hace la lista de Mis citas al aceptar desde allí.
      if (result.bookingId) {
        this.router.navigate(['/citas', result.bookingId]);
        return;
      }
      this.offer = result;
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isConflict) {
        // El hueco se lo ha quedado otro mientras se pensaba. No es un fallo:
        // se recarga para que la pantalla lo diga con claridad.
        await this.load();
        return;
      }
      if (error.isPaymentRequired) {
        this.hasCard = false;
        void this.checkCard();
      }
      this.error = error.message || 'No se ha podido completar. Inténtalo de nuevo.';
    } finally {
      this.sending = false;
    }
  }

  async decline(): Promise<void> {
    if (!this.offer || this.sending) return;
    const ok = await this.dialog.confirm({
      title: '¿Rechazar el hueco?',
      message: 'Saldrás de esta lista de espera y el hueco pasará al siguiente.',
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (!ok) return;

    this.sending = true;
    this.error = null;
    try {
      await this.waitlist.declineOffer(this.offer.id);
      // Se recarga y sale «Lo rechazaste»: desde un enlace de correo no hay a
      // dónde volver, y así queda constancia de lo que se ha hecho.
      await this.load();
    } catch (raw) {
      this.error = ApiError.from(raw).message || 'No se ha podido rechazar. Inténtalo de nuevo.';
    } finally {
      this.sending = false;
    }
  }

  // ----- TARJETA --------------------

  private async checkCard(): Promise<void> {
    try {
      const [config, methods] = await Promise.all([
        this.payments.config(),
        this.payments.methods(),
      ]);
      this.stripeKey = config.publishableKey ?? null;
      this.hasCard = methods.length > 0;
    } catch {
      this.hasCard = null;
    }
  }

  async openCardSheet(): Promise<void> {
    if (!this.stripeKey) {
      this.error = 'La pasarela de pago no está disponible ahora mismo. Inténtalo en un momento.';
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

  /**
   * Tarjeta guardada. Si no queda nada por rellenar se acepta sin otro toque:
   * cada segundo cuenta. Si falta la política o la dirección, se deja hacerlo.
   */
  onCardSaved(): void {
    this.cardSheetOpen = false;
    this.hasCard = true;
    if (this.canAccept) {
      void this.accept();
    }
  }

  onCardSheetClosed(): void {
    this.cardSheetOpen = false;
  }
}
