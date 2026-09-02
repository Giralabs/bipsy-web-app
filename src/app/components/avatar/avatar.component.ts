import { Component, HostBinding, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fixImageUrl } from '../../shared/image-url';

/**
 * Foto de una persona, con iniciales de reserva.
 *
 * Existe porque el hueco de «no hay foto» aparece en varios sitios y siempre se
 * resuelve igual: un círculo con las iniciales sobre el color de superficie.
 * Un icono genérico de persona hace que cuatro profesionales sin foto se vean
 * como cuatro filas idénticas; las iniciales al menos los distinguen.
 *
 * **Hoy ningún trabajador tiene foto**: el backend ya declara
 * `WorkerResponse.profileImageUrl` (un `MediaRef`, que sale serializado como
 * URL absoluta), pero no hay pantalla para subirla. Esto queda montado para
 * que el día que se suba aparezca sola, sin tocar la web.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (src && !broken) {
      <img [src]="src" [alt]="name || 'Foto'" (error)="broken = true" />
    } @else {
      <span class="avatar__initials">{{ initials }}</span>
    }
  `,
  styleUrl: './avatar.component.css',
})
export class AvatarComponent {
  /** Nombre de la persona. De aquí salen las iniciales y el texto alternativo. */
  @Input() name: string | null = null;

  /** Lado del círculo en píxeles. */
  @Input() size = 40;

  /** Una foto que da 404 no debe dejar un icono roto: se cae a las iniciales. */
  broken = false;

  private raw: string | null = null;
  src: string | null = null;

  @Input()
  set photoUrl(value: string | null | undefined) {
    // Solo se recalcula al cambiar de verdad: sin esto, `broken` se reiniciaría
    // en cada ciclo de detección y la imagen rota volvería a intentarse en bucle.
    if (value === this.raw) {
      return;
    }
    this.raw = value ?? null;
    this.src = fixImageUrl(value);
    this.broken = false;
  }

  @HostBinding('style.width.px') get widthPx(): number { return this.size; }
  @HostBinding('style.height.px') get heightPx(): number { return this.size; }
  @HostBinding('style.font-size.px') get fontPx(): number { return Math.round(this.size * 0.36); }

  /**
   * Dos letras como mucho: la del nombre y la del primer apellido. Con nombres
   * compuestos, tres iniciales no caben en un círculo de 40.
   */
  get initials(): string {
    const parts = (this.name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return '?';
    }
    const first = parts[0][0] ?? '';
    const second = parts.length > 1 ? parts[1][0] ?? '' : '';
    return (first + second).toUpperCase();
  }
}
