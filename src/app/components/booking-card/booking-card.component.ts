import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingResponse } from '../../models/bipsy.models';
import { BookingStatusPillComponent } from '../status-pill/booking-status-pill.component';
import { parseLocal, relativeDate, time } from '../../shared/dates';
import { fixImageUrl } from '../../shared/image-url';

/**
 * Una reserva en la lista de Mis citas. Port de `BookingCard`.
 *
 * Sin bajarle la opacidad por ser pasada: un 65 % apagaba la foto, el texto y
 * el estado a la vez, y la lista de "Pasadas" entera se leía como
 * deshabilitada cuando es justo donde se vuelve a reservar. Que sea pasada ya
 * lo dicen la fecha y la pastilla.
 */
@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, BookingStatusPillComponent],
  templateUrl: './booking-card.component.html',
  styleUrl: './booking-card.component.css',
})
export class BookingCardComponent {
  @Input({ required: true }) booking!: BookingResponse;
  /** Foto de portada del negocio, como respaldo de la del servicio. */
  @Input() businessImageUrl?: string;
  @Input() businessName?: string;
  /** Con esto puesto, la tarjeta lleva el botón de repetir la cita. */
  @Input() canRebook = false;

  @Output() open = new EventEmitter<BookingResponse>();
  @Output() rebook = new EventEmitter<BookingResponse>();

  /**
   * La foto del SERVICIO manda, y la del negocio es el respaldo. Es lo que se
   * reservó: en un centro con diez tratamientos, la misma portada en las diez
   * citas no ayuda a distinguirlas de un vistazo.
   */
  get imageUrl(): string | null {
    return fixImageUrl(this.booking.serviceImageUrl) ?? fixImageUrl(this.businessImageUrl);
  }

  get dateLabel(): string {
    return relativeDate(parseLocal(this.booking.startDateTime));
  }

  get timeLabel(): string {
    return time(parseLocal(this.booking.startDateTime));
  }

  onRebookClick(event: MouseEvent): void {
    event.stopPropagation();
    this.rebook.emit(this.booking);
  }
}
