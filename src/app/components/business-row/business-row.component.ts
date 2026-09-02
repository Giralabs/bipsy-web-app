import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BusinessResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../business-card/business-card.component';

/**
 * Una fila horizontal de negocios. Port de `_DiscoveryRow` (Explorar).
 *
 * Las filas personales solo existen si tienen algo: una fila vacía con su
 * título ocupa el sitio de la que sí tiene contenido y no dice nada. La
 * excepción es "Tus favoritos", que sí enseña su cartel — es donde se explica
 * para qué sirve el corazón.
 */
@Component({
  selector: 'app-business-row',
  standalone: true,
  imports: [CommonModule, RouterLink, BusinessCardComponent],
  templateUrl: './business-row.component.html',
  styleUrl: './business-row.component.css',
})
export class BusinessRowComponent {
  @Input({ required: true }) title!: string;
  @Input() businesses: BusinessResponse[] = [];
  @Input() loading = false;

  /** Cartel para cuando la fila está vacía. Sin él, la fila no se pinta. */
  @Input() emptyMessage?: string;

  /**
   * La fila PUEDE contener sitios ya visitados.
   *
   * Que una tarjeta concreta lo sea lo dice su propio
   * `discovery.previouslyBooked`, no esta bandera: forzándolo, un favorito
   * donde nunca has reservado salía con el botón de repetir la cita.
   */
  @Input() markPreviouslyBooked = false;

  /**
   * Enseña los kilómetros. Solo en Destacados, que es la fila que se ordena
   * por distancia: sin el dato a la vista, el salto de un negocio a 2 km a
   * otro a 40 no se entiende.
   */
  @Input() showDistance = false;

  /** Enlace de "Ver todos", si la fila lleva a alguna parte. */
  @Input() seeAllLink?: string;

  @Output() rebook = new EventEmitter<BusinessResponse>();

  readonly skeletons = [1, 2, 3, 4, 5];

  get visible(): boolean {
    return this.loading || this.businesses.length > 0 || !!this.emptyMessage;
  }

  distanceOf(business: BusinessResponse): number | null {
    return this.showDistance ? business.discovery?.distanceKm ?? null : null;
  }

  previouslyBooked(business: BusinessResponse): boolean {
    return this.markPreviouslyBooked && !!business.discovery?.previouslyBooked;
  }
}
