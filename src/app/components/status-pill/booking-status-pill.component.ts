import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookingStatus } from '../../models/bipsy.models';

/**
 * El estado de una reserva: pendiente, confirmada, cancelada o no acudiste.
 *
 * Aquí solo vive la traducción del estado a color, texto e icono; el badge lo
 * pinta la clase `.badge` global, que es la misma que usan las demás
 * pantallas. Port de `BookingStatusPill` + `GipsiStatusPill`.
 */
@Component({
  selector: 'app-booking-status-pill',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge" [ngClass]="'badge--' + tone">
      <span class="material-symbols-rounded fill pill__icon">{{ icon }}</span>
      {{ label }}
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .pill__icon { font-size: 12px; }
  `],
})
export class BookingStatusPillComponent {
  @Input({ required: true }) status!: BookingStatus;

  get tone(): string {
    switch (this.status) {
      case 'CONFIRMED': return 'mint';
      case 'PENDING': return 'warn';
      default: return 'danger';
    }
  }

  get label(): string {
    switch (this.status) {
      case 'CONFIRMED': return 'Confirmada';
      case 'PENDING': return 'Pendiente';
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
      case 'CANCELED': return 'cancel';
      case 'NO_SHOW': return 'do_not_disturb_on';
    }
  }
}
