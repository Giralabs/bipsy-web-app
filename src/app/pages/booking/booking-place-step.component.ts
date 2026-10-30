import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { BusinessResponse, businessLocationDisplay } from '../../models/bipsy.models';
import {
  BookableService,
  BusinessBookingExtras,
  BookingAddress,
  BookingPlace,
  isAddressReady,
  needsPlaceChoice,
} from '../../models/booking-extras.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddressPickerComponent } from '../../components/address-picker/address-picker.component';
import { euros } from '../../shared/dates';

/**
 * Primer paso: ¿en el local o a domicilio? Port de `StepPlace`.
 *
 * Va PRIMERO porque es lo que define la cita: quién, qué día y a qué hora se
 * deciden dentro de esa elección. Y solo existe cuando el servicio se puede
 * prestar en casa; si solo se presta en el local, el flujo se lo salta.
 *
 * La dirección se pide aquí mismo, debajo de la elección, con el selector
 * compartido (`app-address-picker`): las guardadas primero y el formulario
 * solo si hace falta. Es el mismo que usa el aviso de lista de espera, para que
 * elegir a dónde ir funcione igual en las dos puertas.
 *
 * Este paso se puede recorrer sin sesión: entonces no hay libreta ni buscador,
 * y la dirección se escribe a mano. El servidor exige calle y ciudad, y el
 * selector pide exactamente eso.
 */
@Component({
  selector: 'app-booking-place-step',
  standalone: true,
  imports: [ButtonComponent, AddressPickerComponent],
  templateUrl: './booking-place-step.component.html',
  styleUrl: './booking-place-step.component.css',
})
export class BookingPlaceStepComponent {
  @Input({ required: true }) business!: BusinessResponse;
  @Input({ required: true }) service!: BookableService;
  @Input() place: BookingPlace | null = null;
  @Input() address: BookingAddress | null = null;
  /** Sin sesión no hay libreta que leer ni en la que guardar. */
  @Input() signedIn = false;

  @Output() placeChange = new EventEmitter<BookingPlace>();
  @Output() addressChange = new EventEmitter<BookingAddress | null>();
  @Output() next = new EventEmitter<void>();

  @ViewChild(AddressPickerComponent) picker?: AddressPickerComponent;

  continuing = false;

  // ----- VISTA --------------------

  get choosesPlace(): boolean {
    return needsPlaceChoice(this.service);
  }

  /** Se pide la dirección: el servicio solo va a casa, o se ha elegido así. */
  get asksAddress(): boolean {
    return !this.choosesPlace || this.place === 'AT_CUSTOMER';
  }

  get venueLabel(): string {
    return businessLocationDisplay(this.business);
  }

  get homeSubtitle(): string {
    const cents = this.service.homeSurchargeCents ?? 0;
    return cents > 0 ? `Vamos a donde estés · +${euros(cents / 100)}` : 'Vamos a donde estés';
  }

  /** La zona del negocio, para que el selector avise si la dirección cae fuera. */
  get area(): BusinessBookingExtras {
    return this.business as BusinessResponse & BusinessBookingExtras;
  }

  get ready(): boolean {
    return isAddressReady(this.address);
  }

  // ----- ACCIONES --------------------

  choosePlace(place: BookingPlace): void {
    this.placeChange.emit(place);
    if (place === 'AT_BUSINESS') {
      // En el local no hace falta nada más: se avanza en el mismo clic. Y se
      // tira la dirección, que si no viajaría en una cita del local.
      this.addressChange.emit(null);
      this.next.emit();
    }
  }

  /**
   * Sigue al paso siguiente y, de camino, guarda la dirección escrita si se ha
   * pedido. Si el guardado falla, la reserva SIGUE: es lo que el cliente ha
   * venido a hacer.
   */
  async continue(): Promise<void> {
    if (!this.ready || this.continuing) {
      return;
    }
    this.continuing = true;
    try {
      await this.picker?.persistIfAsked();
    } finally {
      this.continuing = false;
    }
    this.next.emit();
  }
}
