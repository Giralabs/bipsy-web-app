import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AvailabilitySlot, SlotUnavailableReason } from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';

interface SlotGroup {
  label: string;
  slots: AvailabilitySlot[];
}

/**
 * Las horas de un día, agrupadas por tramo. Port de `StepTime` de la app, sin
 * la cabecera: la pone quien lo monta.
 *
 * Lo usan reservar y cambiar la hora de una cita, que es exactamente la misma
 * rejilla: si se copia, la segunda copia se queda sin el siguiente arreglo.
 *
 * - **Tramos:** antes de las 14:00 es mañana, hasta las 19:59 tarde, y desde
 *   las 20:00 noche. Con 30 horas seguidas en una rejilla no se encuentra nada.
 * - **Fuera de horario** no se pinta: llenar la rejilla de madrugadas tachadas
 *   cuando el local abre por la tarde no aporta nada.
 * - **Ocupadas** sí se ven, apagadas: dicen que ese día hay vida, y que la hora
 *   que buscabas existe pero ya está cogida.
 */
@Component({
  selector: 'app-slot-grid',
  standalone: true,
  imports: [NgTemplateOutlet, ButtonComponent],
  templateUrl: './slot-grid.component.html',
  styleUrl: './slot-grid.component.css',
})
export class SlotGridComponent {
  @Input() slots: AvailabilitySlot[] = [];
  @Input() selected?: string | null;
  @Input() loading = false;
  /** No se ha podido cargar la disponibilidad. */
  @Input() error: string | null = null;

  /**
   * Ofrecer la lista de espera. False al CAMBIAR la hora de una cita: esa
   * persona ya tiene su hueco, y ofrecerle esperar por otro solo confunde.
   */
  @Input() allowWaitlist = false;
  @Input() waitlistBusy = false;
  @Input() waitlistDone = false;

  /** El cliente eligió un profesional concreto: cambia el texto de "de baja". */
  @Input() hasWorkerFilter = false;

  @Output() pick = new EventEmitter<AvailabilitySlot>();
  @Output() waitlist = new EventEmitter<void>();
  @Output() changeDay = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();

  /** Doce pastillas grises mientras carga: la forma de lo que viene. */
  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  /** Lo que se pinta: todo menos lo que cae fuera del horario. */
  get visible(): AvailabilitySlot[] {
    return this.slots.filter(s => s.available || s.reason !== 'OUT_OF_SCHEDULE');
  }

  /** Vacaciones o baja: todas las horas son TIME_OFF. */
  get allTimeOff(): boolean {
    const v = this.visible;
    return v.length > 0 && v.every(s => !s.available && s.reason === 'TIME_OFF');
  }

  /** Todo ocupado: justo el caso para el que existe la lista de espera. */
  get allTaken(): boolean {
    const v = this.visible;
    return v.length > 0 && v.every(s => !s.available);
  }

  get groups(): SlotGroup[] {
    const morning: AvailabilitySlot[] = [];
    const afternoon: AvailabilitySlot[] = [];
    const evening: AvailabilitySlot[] = [];
    for (const s of this.visible) {
      const hour = Number(s.start.split(':')[0]);
      if (hour < 14) {
        morning.push(s);
      } else if (hour < 20) {
        afternoon.push(s);
      } else {
        evening.push(s);
      }
    }
    return [
      { label: 'Mañana', slots: morning },
      { label: 'Tarde', slots: afternoon },
      { label: 'Noche', slots: evening },
    ].filter(g => g.slots.length > 0);
  }

  choose(slot: AvailabilitySlot): void {
    if (slot.available) {
      this.pick.emit(slot);
    }
  }

  ariaLabel(slot: AvailabilitySlot): string {
    return slot.available ? slot.start : `${slot.start}, ${reasonLabel(slot.reason).toLowerCase()}`;
  }

  reason(slot: AvailabilitySlot): string | null {
    return slot.available ? null : reasonLabel(slot.reason);
  }
}

function reasonLabel(reason?: SlotUnavailableReason): string {
  switch (reason) {
    case 'BOOKED': return 'Ya reservado';
    case 'OUT_OF_SCHEDULE': return 'Fuera de horario';
    case 'TIME_OFF': return 'El negocio no trabaja en este momento';
    case 'OVERTIME_NOT_ALLOWED': return 'No cabe la duración del servicio';
    case 'WORKER_UNAVAILABLE': return 'Profesional no disponible';
    default: return 'No disponible';
  }
}
