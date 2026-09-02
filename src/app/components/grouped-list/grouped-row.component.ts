import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Una fila de [GroupedSectionComponent]: concepto a la izquierda, valor a la
 * derecha. Port de `GipsiGroupedRow`.
 *
 * El galón solo cuando la fila LLEVA a otro sitio: elegir algo aquí mismo no
 * es navegar.
 */
@Component({
  selector: 'app-grouped-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grouped-row.component.html',
  styleUrl: './grouped-row.component.css',
})
export class GroupedRowComponent {
  @Input({ required: true }) label!: string;
  /** El dato, a la derecha. Se ignora si hay contenido proyectado. */
  @Input() value?: string | null;
  /** Segunda línea bajo la etiqueta, en gris. */
  @Input() subtitle?: string | null;
  /** Icono a la izquierda (nombre de Material Symbols). */
  @Input() icon?: string;
  @Input() disabled = false;
  /** En rojo del sistema. Para lo que borra o cancela. */
  @Input() destructive = false;
  /** La fila lleva a otro sitio: sale el galón y responde al clic. */
  @Input() navigates = false;

  @Output() action = new EventEmitter<void>();

  get interactive(): boolean {
    return !this.disabled && this.action.observed;
  }

  onClick(): void {
    if (this.interactive) {
      this.action.emit();
    }
  }
}
