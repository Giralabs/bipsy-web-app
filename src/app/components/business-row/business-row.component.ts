import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BusinessResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../business-card/business-card.component';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';

/**
 * Una fila horizontal de negocios. Port de `_DiscoveryRow` (Explorar).
 *
 * Las filas personales solo existen si tienen algo: una fila vacía con su
 * título ocupa el sitio de la que sí tiene contenido y no dice nada. La
 * excepción es "Tus favoritos", que sí enseña su cartel — es donde se explica
 * para qué sirve el corazón.
 *
 * En escritorio lleva flechas: con ratón, una fila que se sale por la derecha
 * no se descubre sola.
 */
@Component({
  selector: 'app-business-row',
  standalone: true,
  imports: [CommonModule, RouterLink, BusinessCardComponent, DragScrollDirective],
  templateUrl: './business-row.component.html',
  styleUrl: './business-row.component.css',
})
export class BusinessRowComponent {
  @Input({ required: true }) title!: string;

  /** Una línea bajo el título que dice por qué estos y no otros. */
  @Input() subtitle?: string;

  /** Icono del disco junto al título. */
  @Input() icon?: string;

  @Input() businesses: BusinessResponse[] = [];
  @Input() loading = false;

  /** Cartel para cuando la fila está vacía. Sin él, la fila no se pinta. */
  @Input() emptyMessage?: string;

  /** Icono del cartel vacío. */
  @Input() emptyIcon = 'favorite';

  /** Botón opcional dentro del cartel vacío (p. ej. «Inicia sesión»). */
  @Input() emptyActionLabel?: string;
  @Output() emptyAction = new EventEmitter<void>();

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

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  readonly skeletons = [1, 2, 3, 4, 5];

  atStart = true;
  atEnd = false;

  get visible(): boolean {
    return this.loading || this.businesses.length > 0 || !!this.emptyMessage;
  }

  distanceOf(business: BusinessResponse): number | null {
    return this.showDistance ? business.discovery?.distanceKm ?? null : null;
  }

  previouslyBooked(business: BusinessResponse): boolean {
    return this.markPreviouslyBooked && !!business.discovery?.previouslyBooked;
  }

  /** Avanza casi una pantalla de fila: la última tarjeta visible queda la primera. */
  scrollBy(direction: 1 | -1): void {
    const el = this.scroller?.nativeElement;
    if (!el) {
      return;
    }
    el.scrollBy({ left: direction * Math.max(260, el.clientWidth * 0.85), behavior: 'smooth' });
  }

  onScroll(): void {
    const el = this.scroller?.nativeElement;
    if (!el) {
      return;
    }
    this.atStart = el.scrollLeft <= 4;
    this.atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
  }
}
