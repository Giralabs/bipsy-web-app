import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BookingResponse, bookingPrice } from '../../models/bipsy.models';
import { isAwaitingCustomer } from '../../models/confirm.models';
import { BookingStatusPillComponent } from '../status-pill/booking-status-pill.component';
import { capitalize, euros, parseLocal, relativeDate, time } from '../../shared/dates';
import { fixImageUrl } from '../../shared/image-url';

const WEEKDAY = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'short' });

/**
 * Una reserva en la lista de Mis citas. Port de `BookingCard`.
 *
 * Como en la app: la foto del servicio a sangre por la izquierda, el nombre,
 * el negocio y «Mañana · 13:00», y el estado como icono a la derecha. Antes
 * la web llevaba una hoja de calendario en su lugar y la tarjeta no se parecía
 * a la de la app. Las canceladas se tachan, sin apagar la tarjeta.
 */
@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [CommonModule, BookingStatusPillComponent],
  templateUrl: './booking-card.component.html',
  styleUrl: './booking-card.component.css',
})
export class BookingCardComponent {
  private readonly router = inject(Router);

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

  /** La foto no cargó: se pinta el hueco de marca en vez del icono roto. */
  imageFailed = false;

  get startTime(): string {
    return time(this.start);
  }

  get timeRange(): string {
    return `${time(this.start)} – ${time(parseLocal(this.booking.endDateTime))}`;
  }

  /**
   * `_formatDate` de la tarjeta de la app: «Hoy», «Mañana», «Ayer», el día
   * abreviado dentro de la semana —«Lun»— y si no «Mié 21 oct». Va aquí y no
   * con `relativeDate`, que escribe el día entero y con coma («Mié, 21 oct»):
   * en una línea que anda justa cada carácter cuenta.
   */
  get relative(): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const s = this.start;
    const diff = Math.round((new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime() - today) / 86_400_000);
    if (diff === 0 || diff === 1 || diff === -1) return relativeDate(s);
    const weekday = capitalize(WEEKDAY.format(s).replace('.', ''));
    if (diff > 1 && diff <= 7) return weekday;
    return `${weekday} ${s.getDate()} ${MONTH.format(s).replace('.', '')}`;
  }

  /** «Para Marta», si la cita no es para quien la reservó. */
  get attendeeLabel(): string | null {
    const name = this.booking.attendeeName?.trim();
    return name ? `Para ${name}` : null;
  }

  get priceLabel(): string | null {
    const price = bookingPrice(this.booking);
    return price === null ? null : euros(price);
  }

  get isOff(): boolean {
    return this.booking.status === 'CANCELED' || this.booking.status === 'NO_SHOW';
  }

  /** La puso el negocio y espera que la aceptes, con un plazo corriendo. */
  get awaiting(): boolean {
    return isAwaitingCustomer(this.booking);
  }

  /**
   * Abrir la tarjeta. La que espera respuesta va directa a confirmarla y no al
   * detalle: el detalle no tiene los botones de aceptar, y con diez minutos de
   * plazo un paso de más es la cita perdida. Se decide aquí y no en cada lista
   * que use la tarjeta, para que ninguna se olvide.
   */
  onOpen(): void {
    if (this.awaiting) {
      this.router.navigate(['/citas', this.booking.id, 'confirmar']);
      return;
    }
    this.open.emit(this.booking);
  }

  /**
   * Intro o Espacio sobre la TARJETA, no sobre lo que lleva dentro: la tecla
   * pulsada en «Repetir» sube hasta aquí, y abría la cita además de repetirla
   * —dos navegaciones a la vez—. Espacio, porque es lo que se espera de algo
   * que se anuncia como botón, y sin `preventDefault` bajaría la página.
   */
  onKeyOpen(event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    this.onOpen();
  }

  onRebookClick(event: MouseEvent): void {
    event.stopPropagation();
    this.rebook.emit(this.booking);
  }
}
