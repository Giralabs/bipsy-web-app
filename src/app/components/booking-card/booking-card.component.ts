import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingResponse, bookingPrice } from '../../models/bipsy.models';
import { BookingStatusPillComponent } from '../status-pill/booking-status-pill.component';
import { euros, parseLocal, relativeDate, time } from '../../shared/dates';
import { fixImageUrl } from '../../shared/image-url';

const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'short' });

/**
 * Una reserva en la lista de Mis citas. Port de `BookingCard`.
 *
 * La fecha va en hoja de calendario a la izquierda: en una lista de citas lo
 * que se busca primero es el día. La foto del servicio, si la hay, acompaña.
 * Las canceladas se apagan un poco, pero sin llegar a leerse deshabilitadas.
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

  private get start(): Date {
    return parseLocal(this.booking.startDateTime);
  }

  get imageUrl(): string | null {
    return fixImageUrl(this.booking.serviceImageUrl) ?? fixImageUrl(this.businessImageUrl);
  }

  get weekday(): string {
    return WEEKDAY.format(this.start).replace('.', '');
  }

  get day(): string {
    return String(this.start.getDate());
  }

  get month(): string {
    return MONTH.format(this.start).replace('.', '');
  }

  get timeRange(): string {
    return `${time(this.start)} – ${time(parseLocal(this.booking.endDateTime))}`;
  }

  get relative(): string {
    return relativeDate(this.start);
  }

  get priceLabel(): string | null {
    const price = bookingPrice(this.booking);
    return price === null ? null : euros(price);
  }

  get isOff(): boolean {
    return this.booking.status === 'CANCELED' || this.booking.status === 'NO_SHOW';
  }

  onRebookClick(event: MouseEvent): void {
    event.stopPropagation();
    this.rebook.emit(this.booking);
  }
}
