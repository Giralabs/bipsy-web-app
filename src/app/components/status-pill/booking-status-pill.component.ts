import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerBookingStatus } from '../../models/confirm.models';

/**
 * El estado de una reserva: pendiente, por confirmar, confirmada, cancelada o
 * no acudiste.
 *
 * Aquí solo vive la traducción del estado a color, texto e icono; el badge lo
 * pinta la clase `.badge` global, que es la misma que usan las demás
 * pantallas. Port de `BookingStatusPill` + `GipsiStatusPill`.
 *
 * `compact` es la variante de la lista de Mis citas en la app: solo el icono,
 * a 20, en el color del estado. El texto se comía el ancho del nombre del
 * servicio, que es por lo que se reconoce una cita; entero va al lector de
 * pantalla y se ve al entrar.
 */
@Component({
  selector: 'app-booking-status-pill',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (compact) {
      <span class="pill__compact" [ngClass]="'pill__compact--' + tone" role="img" [attr.aria-label]="label" [title]="label">
        <span class="material-symbols-rounded fill" aria-hidden="true">{{ icon }}</span>
      </span>
    } @else {
      <span class="badge" [ngClass]="'badge--' + tone">
        <!-- Sin aria-hidden el lector leía el nombre del glifo («check_circle»)
             delante del estado. -->
        <span class="material-symbols-rounded fill pill__icon" aria-hidden="true">{{ icon }}</span>
        {{ label }}
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .pill__icon { font-size: 12px; }
    .pill__compact { display: inline-flex; }
    .pill__compact .material-symbols-rounded { font-size: 22px; }
    .pill__compact--mint { color: var(--clr-mint); }
    .pill__compact--warn { color: var(--clr-warn); }
    .pill__compact--danger { color: var(--clr-danger-text); }
  `],
})
export class BookingStatusPillComponent {
  @Input({ required: true }) status!: CustomerBookingStatus;
  /** Solo el icono, como `BookingStatusPill(compact: true)` de la app. */
  @Input() compact = false;

  get tone(): string {
    switch (this.status) {
      case 'CONFIRMED': return 'mint';
      case 'PENDING': return 'warn';
      // La puso el negocio y espera tu sí con un plazo corriendo: avisa.
      case 'AWAITING_CUSTOMER': return 'warn';
      default: return 'danger';
    }
  }

  get label(): string {
    switch (this.status) {
      case 'CONFIRMED': return 'Confirmada';
      case 'PENDING': return 'Pendiente';
      case 'AWAITING_CUSTOMER': return 'Por confirmar';
      case 'CANCELED': return 'Cancelada';
      // El negocio ha marcado que el cliente no acudió. En rojo porque suele
      // venir acompañado de un cargo.
      case 'NO_SHOW': return 'No acudiste';
    }
  }

  get icon(): string {
    switch (this.status) {
      case 'CONFIRMED': return 'check_circle';
      case 'PENDING': return 'hourglass_top';
      // `touch_app`, como la app: hay que tocar para responder.
      case 'AWAITING_CUSTOMER': return 'touch_app';
      case 'CANCELED': return 'cancel';
      case 'NO_SHOW': return 'do_not_disturb_on';
    }
  }
}
