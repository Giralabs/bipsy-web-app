import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BusinessResponse, businessLocationDisplay, primaryCategory } from '../../models/bipsy.models';
import { businessPath } from '../../shared/slug';
import { fixImageUrl, placeholderImage } from '../../shared/image-url';

/**
 * Tarjeta de un negocio. Port de `_GlassHomeCard` (Explorar, app cliente).
 *
 * "Elevación por luz": ni desenfoque, ni borde, ni sombra. La tarjeta se
 * distingue por ser más clara que el suelo. La foto llega a los cantos —con
 * margen se veían dos rectángulos, uno dentro de otro, y parecía un marco— y
 * las insignias que van encima llevan su propio fondo oscuro, así que no hace
 * falta oscurecer media imagen para que se lean.
 */
@Component({
  selector: 'app-business-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.css'
})
export class BusinessCardComponent {
  @Input() business!: BusinessResponse;

  /** En la fila horizontal. Hoy solo condiciona el ancho, que pone el padre. */
  @Input() compact = false;

  /** Ya has reservado aquí: sale el reloj y el botón de repetir. */
  @Input() previouslyBooked = false;

  /** Negocio recién abierto. Puede salir a la vez que el reloj. */
  @Input() isNew = false;

  /** Kilómetros hasta el negocio. Solo llega en la fila ordenada por distancia. */
  @Input() distanceKm: number | null = null;

  /** Volver a reservar lo mismo. El padre decide a dónde lleva. */
  @Output() rebook = new EventEmitter<BusinessResponse>();

  get imageUrl(): string {
    const fixed = fixImageUrl(this.business?.coverImageUrl || this.business?.profileImageUrl);
    if (fixed) {
      return fixed;
    }
    return placeholderImage(this.business?.id ?? 0, primaryCategory(this.business)?.code);
  }

  /** `/business/barberia-el-maestro-3`: el id al final y el nombre delante. */
  get link(): string[] {
    return businessPath(this.business);
  }

  get locationDisplay(): string {
    return businessLocationDisplay(this.business);
  }

  get hasRating(): boolean {
    return typeof this.business?.averageRating === 'number' &&
           this.business.averageRating > 0;
  }

  get ratingDisplay(): string {
    return (this.business?.averageRating ?? 0).toFixed(1).replace('.', ',');
  }

  get reviewCount(): number {
    return this.business?.reviewCount ?? 0;
  }

  /** Un decimal y coma, como `GipsiFormat.distanceKm`. */
  get distanceDisplay(): string | null {
    if (this.distanceKm === null) {
      return null;
    }
    return `${this.distanceKm.toFixed(1).replace('.', ',')} km`;
  }

  onRebookClick(event: MouseEvent): void {
    // La tarjeta entera es un enlace a la ficha: sin esto, repetir la cita
    // navegaría también al negocio y el flujo de reserva se abriría encima.
    event.preventDefault();
    event.stopPropagation();
    this.rebook.emit(this.business);
  }
}
