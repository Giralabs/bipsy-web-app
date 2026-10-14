import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocialAuthService, SocialProvider } from '../../core/social-auth.service';

/**
 * Los botones de Google y Apple, con sus logotipos de verdad.
 *
 * Existen como componente porque son **tres** los sitios que los necesitan:
 * entrar, crear cuenta y el paso de entrada del flujo de reserva. Estaban
 * copiados en los dos primeros, y la reserva llegó a montar unos propios con
 * `app-button` — que se veían bien y **no los reconocía nadie**: el logotipo de
 * Google y el de Apple no se pueden sustituir por un icono de Material ni por
 * un texto, porque lo que hace que alguien se fíe de ese botón es justo eso.
 *
 * Los estilos (`.google-btn`, `.apple-btn`, `.social-btns`) viven en
 * `styles.css` y no aquí: ya eran globales antes de este componente, los usan
 * las pantallas de auth, y moverlos ahora sería tocar tres pantallas aprobadas
 * para no ganar nada.
 *
 * ⚠️ Los colores son los de las guías de marca —blanco el de Google, negro el
 * de Apple— y no se tocan, aunque no casen con el resto de la pantalla. Ahí está
 * la gracia: son reconocibles porque son iguales en todas partes.
 */
@Component({
  selector: 'app-social-buttons',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-buttons.component.html',
})
export class SocialButtonsComponent {
  private readonly social = inject(SocialAuthService);

  /** El proveedor que está en marcha, si hay alguno: pinta su spinner. */
  @Input() busy: SocialProvider | null = null;

  /** Bloquea los dos. Lo usa quien tiene otra cosa en curso en la pantalla. */
  @Input() disabled = false;

  @Output() chosen = new EventEmitter<SocialProvider>();

  get googleAvailable(): boolean {
    return this.social.googleAvailable;
  }

  get appleAvailable(): boolean {
    return this.social.appleAvailable;
  }

  /** Si hay alguno que ofrecer. Sin esto, quien llama pinta un hueco vacío. */
  get available(): boolean {
    return this.googleAvailable || this.appleAvailable;
  }
}
