import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Bloque de filas al estilo de los Ajustes de iOS. Port de
 * `GipsiGroupedSection`.
 *
 * El encabezado va **fuera** del bloque y en mayúsculas, como el del sistema.
 * El pie es para explicar una condición o una consecuencia, no para repetir lo
 * de arriba.
 */
@Component({
  selector: 'app-grouped-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (header) {
      <p class="grp__header">{{ header.toUpperCase() }}</p>
    }
    <div class="grp__box"><ng-content></ng-content></div>
    @if (footer) {
      <p class="grp__footer">{{ footer }}</p>
    }
  `,
  styleUrl: './grouped-section.component.css',
})
export class GroupedSectionComponent {
  @Input() header?: string;
  @Input() footer?: string;
}
