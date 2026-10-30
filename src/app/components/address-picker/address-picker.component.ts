import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BookingAddress,
  CustomerAddress,
  ResolvedAddress,
  addressOneLine,
  isAddressReady,
} from '../../models/booking-extras.models';
import { ServiceArea, outOfServiceArea } from '../../models/address-picker.models';
import { BookingExtrasRepository } from '../../repositories/booking-extras.repository';
import { ButtonComponent } from '../button/button.component';
import { AddressStreetFieldComponent } from './address-street-field.component';

/**
 * ¿A dónde vamos? Las direcciones guardadas y, si hace falta, una nueva.
 * Port de `SavedAddressList` + `AddressForm` de la app.
 *
 * Lo comparten el paso «¿Dónde te atendemos?» del flujo de reserva y el aviso
 * de hueco libre de la lista de espera. Las guardadas primero, con la
 * predeterminada ya marcada: quien tiene su casa en la libreta elige en un
 * clic, y en el aviso —con el plazo corriendo— eso es quedarse el hueco o no.
 *
 * El formulario pide calle y ciudad, que es lo que exige el servidor; el
 * buscador de Google rellena la ciudad, el código postal y las coordenadas,
 * pero sin él (sin sesión, o si no contesta) se escribe a mano y vale igual.
 *
 * No tiene botón de seguir: cada pantalla pone el suyo, porque lo que pasa
 * después no se parece en nada (avanzar un paso o aceptar un hueco).
 */
@Component({
  selector: 'app-address-picker',
  standalone: true,
  imports: [FormsModule, ButtonComponent, AddressStreetFieldComponent],
  templateUrl: './address-picker.component.html',
  styleUrl: './address-picker.component.css',
})
export class AddressPickerComponent implements OnInit {
  private readonly repo = inject(BookingExtrasRepository);

  /** La elegida ahora. La pantalla la guarda y la devuelve en cada cambio. */
  @Input() address: BookingAddress | null = null;
  /** Sin sesión no hay libreta que leer ni buscador que consultar. */
  @Input() signedIn = true;
  @Input() disabled = false;
  /** Ofrecer «Guardar en mis direcciones» al escribir una nueva. */
  @Input() allowSave = true;

  // Para el aviso de fuera de zona. Sin zona no se avisa de nada.
  @Input() area: ServiceArea | null = null;
  @Input() businessName = '';
  /** Lo que el cliente está a punto de hacer: «reservar» o «quedarte el hueco». */
  @Input() verb = 'reservar';

  @Output() addressChange = new EventEmitter<BookingAddress | null>();

  /** Null mientras carga la libreta. */
  saved: CustomerAddress[] | null = null;
  /** El cliente ha pedido escribir una que no tiene guardada. */
  writingOther = false;
  /**
   * Guardarla en su libreta. Encendido de partida: quien la escribe es porque
   * va a usarla. Se apaga de un clic para la que es de una vez —la casa de tu
   * madre, un hotel—.
   */
  saveToBook = true;

  // ----- FORMULARIO --------------------
  street = '';
  city = '';
  details = '';
  postalCode = '';
  /** Lo que dio el buscador. Se tira al teclear la calle a mano. */
  private resolved: ResolvedAddress | null = null;

  readonly uid = Math.random().toString(36).slice(2, 8);

  async ngOnInit(): Promise<void> {
    // Lo que llega ya estaba elegido —se vuelve a este paso desde otro—, así
    // que se da por bueno tal cual, ciudad y coordenadas incluidas.
    if (this.address) {
      this.street = this.address.address ?? '';
      this.details = this.address.details ?? '';
      this.city = this.address.city ?? '';
      this.postalCode = this.address.postalCode ?? '';
      this.resolved = {
        address: this.address.address,
        city: this.address.city,
        province: this.address.province,
        postalCode: this.address.postalCode,
        latitude: this.address.latitude,
        longitude: this.address.longitude,
        placeId: this.address.placeId,
      };
    }

    if (!this.signedIn) {
      this.saved = [];
      return;
    }
    try {
      this.saved = await this.repo.addresses();
    } catch {
      // Si la libreta no carga, se escribe a mano: quedarse sin poder seguir
      // porque falla una lista de conveniencia sería absurdo.
      this.saved = [];
    }
    this.preselectDefault();
    // Viene con una dirección que no está en la libreta: es una escrita a
    // mano, así que se enseña el formulario con ella y no la lista.
    if (this.address && this.saved.length > 0 && !this.saved.some(a => this.isChosen(a))) {
      this.writingOther = true;
    }
  }

  // ----- VISTA --------------------

  get showList(): boolean {
    return !!this.saved && this.saved.length > 0 && !this.writingOther;
  }

  get showForm(): boolean {
    return !!this.saved && !this.showList;
  }

  get ready(): boolean {
    return isAddressReady(this.address);
  }

  /**
   * La dirección elegida cae fuera de la zona del negocio. Se dice AQUÍ y no
   * al final: enterarse por un error del servidor es el peor momento.
   */
  get outOfArea(): boolean {
    return outOfServiceArea(this.area, this.address);
  }

  get radiusLabel(): string {
    const km = this.area?.serviceRadiusKm;
    return km ? ` (${km} km)` : '';
  }

  /** Esa dirección no lleva número: avisa, no bloquea. */
  get missingNumber(): boolean {
    return !!this.resolved?.placeId && this.resolved.streetNumber === null;
  }

  oneLine(a: CustomerAddress): string {
    return addressOneLine(a.address);
  }

  title(a: CustomerAddress): string {
    return a.label?.trim() || (a.isDefault ? 'Casa' : a.address.address || 'Dirección');
  }

  /**
   * Dos direcciones del mismo cliente no comparten calle y puerta, así que con
   * eso basta para saber cuál está marcada.
   */
  isChosen(a: CustomerAddress): boolean {
    return !!this.address
      && (this.address.address ?? '') === (a.address.address ?? '')
      && (this.address.details ?? '') === (a.address.details ?? '');
  }

  // ----- ACCIONES --------------------

  chooseSaved(a: CustomerAddress): void {
    if (!this.disabled) {
      this.addressChange.emit({ ...a.address });
    }
  }

  /** Empieza a escribir una nueva, con el formulario EN BLANCO. */
  writeOther(): void {
    this.street = '';
    this.details = '';
    this.city = '';
    this.postalCode = '';
    this.resolved = null;
    this.addressChange.emit(null);
    this.writingOther = true;
  }

  /** Vuelve a la lista y descarta lo escrito. */
  backToList(): void {
    this.writingOther = false;
    this.addressChange.emit(null);
    this.preselectDefault(true);
  }

  onStreetChange(text: string): void {
    this.street = text;
    this.emitAddress();
  }

  /** Lo que dio el buscador: rellena la ciudad y el código postal si los trae. */
  onResolved(r: ResolvedAddress | null): void {
    this.resolved = r;
    if (r?.city) this.city = r.city;
    if (r?.postalCode) this.postalCode = r.postalCode;
    this.emitAddress();
  }

  onFieldInput(): void {
    this.emitAddress();
  }

  /**
   * Guarda en la libreta la dirección escrita, si se ha pedido. La llama la
   * pantalla al seguir. Si falla, NO para nada: guardar es una conveniencia, y
   * perder la cita o el hueco por ella sería absurdo.
   */
  async persistIfAsked(): Promise<void> {
    if (!this.showForm || !this.signedIn || !this.allowSave || !this.saveToBook || !this.address || !this.ready) {
      return;
    }
    try {
      await this.repo.createAddress(this.address);
    } catch {
      // Sin ruido: no es lo que el cliente estaba haciendo.
    }
  }

  // ----- INTERNO --------------------

  /**
   * Pone sola la de siempre, si no hay ya otra elegida. Es lo que promete
   * «Mis direcciones»: sin esto tener una predeterminada no servía de nada.
   */
  private preselectDefault(force = false): void {
    if (!this.saved || this.saved.length === 0 || (!force && this.address)) {
      return;
    }
    const preferred = this.saved.find(a => a.isDefault) ?? this.saved[0];
    this.addressChange.emit({ ...preferred.address });
  }

  private emitAddress(): void {
    const street = this.street.trim();
    if (!street) {
      this.addressChange.emit(null);
      return;
    }
    const r = this.resolved;
    this.addressChange.emit({
      address: street,
      details: this.details.trim() || undefined,
      city: this.city.trim() || undefined,
      province: r?.province ?? undefined,
      postalCode: this.postalCode.trim() || undefined,
      latitude: r?.latitude ?? undefined,
      longitude: r?.longitude ?? undefined,
      placeId: r?.placeId ?? undefined,
    });
  }
}
