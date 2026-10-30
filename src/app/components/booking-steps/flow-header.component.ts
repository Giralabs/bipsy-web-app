import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Cabecera de un flujo por pasos: salir, título y por dónde va. Port de
 * `GipsiFlowHeader`.
 *
 * En el móvil, como la app: acción a la izquierda, la pregunta del paso en el
 * centro y una línea fina debajo que se va llenando, sin «Paso 2 de 4».
 *
 * En escritorio esa misma cabecera parecía una fila de pestañas —un enlace
 * menta subrayado por la barra—. Ahí la acción es un botón de verdad, la
 * pregunta va en grande alineada a la izquierda con «Paso N de M» encima, y la
 * barra va aparte, más gruesa, a lo ancho de la columna. Con la pantalla ancha
 * sí sobra sitio para el contador, y quien reserva con ratón lo agradece.
 *
 * El texto de volver cambia con el paso —«Cancelar» en el primero, «Atrás» en
 * los demás— porque no hacen lo mismo: uno sale del flujo y el otro retrocede.
 */
@Component({
  selector: 'app-flow-header',
  standalone: true,
  template: `
    <div class="fh">
      <div class="fh__bar">
        @if (showBack) {
          <button type="button" class="fh__back" (click)="back.emit()">
            <span class="material-symbols-rounded fh__back-icon" aria-hidden="true">{{ atStart ? 'close' : 'arrow_back' }}</span>
            {{ backLabel ?? (atStart ? 'Cancelar' : 'Atrás') }}
          </button>
        }
        <div class="fh__heading">
          @if (stepCount > 1 && stepNumber > 0) {
            <p class="fh__count">Paso {{ stepNumber }} de {{ stepCount }}</p>
          }
          <h1 class="fh__title">{{ title }}</h1>
        </div>
      </div>
      <div
        class="fh__track"
        role="progressbar"
        aria-label="Progreso de la reserva"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="percent"
        [attr.aria-valuetext]="stepCount > 1 && stepNumber > 0 ? 'Paso ' + stepNumber + ' de ' + stepCount : null"
      >
        <div class="fh__fill" [style.width.%]="percent"></div>
      </div>
    </div>
  `,
  styleUrl: './flow-header.component.css',
})
export class FlowHeaderComponent {
  @Input({ required: true }) title!: string;
  /** De 0 a 1. */
  @Input() progress = 0;
  /** En el primer paso el botón sale del flujo; en los demás, retrocede. */
  @Input() atStart = false;
  /** Para cuando no es ni «Atrás» ni «Cancelar». */
  @Input() backLabel?: string;
  /** Sin salida no se pinta botón: uno que no se puede pulsar es peor que ninguno. */
  @Input() showBack = true;
  /** «Paso N de M», solo en escritorio. Sin ellos no se pinta el contador. */
  @Input() stepNumber = 0;
  @Input() stepCount = 0;

  @Output() back = new EventEmitter<void>();

  get percent(): number {
    return Math.round(Math.min(1, Math.max(0, this.progress)) * 100);
  }
}
