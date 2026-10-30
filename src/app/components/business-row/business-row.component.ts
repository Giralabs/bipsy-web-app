import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
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
 *
 * Las filas paginadas (`hasMore`) piden la página siguiente con `loadMore` al
 * acercarse al final, como `PagedBusinessRow` en la app. También cuando la fila
 * no llega a desbordar: en una pantalla ancha caben las cinco de la primera
 * página y sin eso no habría scroll que llegara al final nunca.
 */
@Component({
  selector: 'app-business-row',
  standalone: true,
  imports: [CommonModule, RouterLink, BusinessCardComponent, DragScrollDirective],
  templateUrl: './business-row.component.html',
  styleUrl: './business-row.component.css',
})
export class BusinessRowComponent implements OnChanges, OnDestroy {
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

  /** Queda otra página en el servidor. */
  @Input() hasMore = false;
  /** Se acerca el final y queda más: quien la monta pide la siguiente. */
  @Output() loadMore = new EventEmitter<void>();

  @Output() rebook = new EventEmitter<BusinessResponse>();

  @ViewChild('scroller') scroller?: ElementRef<HTMLElement>;

  readonly skeletons = [1, 2, 3, 4, 5];

  atStart = true;
  atEnd = false;
  private frame?: number;

  get visible(): boolean {
    return this.loading || this.businesses.length > 0 || !!this.emptyMessage;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['businesses'] || changes['hasMore'] || changes['loading']) {
      // Tras pintar: hasta entonces no se sabe si la fila desborda.
      cancelAnimationFrame(this.frame ?? 0);
      this.frame = requestAnimationFrame(() => this.onScroll());
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame ?? 0);
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
    const left = el.scrollWidth - (el.scrollLeft + el.clientWidth);
    // Con más por llegar, la flecha sigue viva: el final todavía no lo es.
    this.atEnd = left <= 4 && !this.hasMore;
    // Media pantalla antes del final: la página llega antes de que se note.
    if (this.hasMore && !this.loading && left < el.clientWidth / 2) {
      this.loadMore.emit();
    }
  }
}
