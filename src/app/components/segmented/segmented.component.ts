import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Selector segmentado. Port de `GipsiSegmented`.
 *
 * Dos opciones excluyentes sobre la misma lista es exactamente para lo que
 * sirve el segmentado del sistema, y no una fila de pestañas.
 *
 * El pulgar es una variación de luminosidad de la pista —un peldaño más claro
 * en oscuro, blanco en claro— y NO el acento de la marca: con el pulgar de
 * color, ningún color de texto vale para los dos fondos y siempre hay un tramo
 * de la animación en que la etiqueta no se lee.
 */
@Component({
  selector: 'app-segmented',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.css',
})
export class SegmentedComponent {
  @Input() labels: string[] = [];
  @Input() selectedIndex = 0;
  @Input() disabled = false;

  @Output() selectedIndexChange = new EventEmitter<number>();

  select(index: number): void {
    if (this.disabled || index === this.selectedIndex) {
      return;
    }
    this.selectedIndexChange.emit(index);
  }

  get thumbStyle(): Record<string, string> {
    const count = Math.max(this.labels.length, 1);
    return {
      width: `calc(${100 / count}% - 4px)`,
      transform: `translateX(calc(${this.selectedIndex * 100}% + ${this.selectedIndex * 4}px))`,
    };
  }
}
