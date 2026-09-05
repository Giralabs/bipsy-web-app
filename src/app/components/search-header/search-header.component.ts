import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { SearchBarComponent } from '../search-bar/search-bar.component';

/** A partir de aquí el header compacto sustituye al normal. */
const REVEAL_AT_PX = 180;

/**
 * Header compacto que aparece al bajar.
 *
 * **No sustituye al header normal, lo tapa.** Va `fixed` con un z-index por
 * encima de la barra `sticky`, y entra deslizándose cuando se ha bajado de
 * {@link REVEAL_AT_PX}. Arriba del todo no se pinta y la cabecera de siempre
 * queda intacta, que es la condición que se puso.
 *
 * Aquí solo vive el armazón —marca, sesión y el aparecer al bajar—: los tres
 * campos son `app-search-bar`, que también usa el hero de la portada.
 */
@Component({
  selector: 'app-search-header',
  standalone: true,
  imports: [CommonModule, RouterLink, SearchBarComponent],
  templateUrl: './search-header.component.html',
  styleUrl: './search-header.component.css',
})
export class SearchHeaderComponent implements OnInit {
  readonly session = inject(SessionService);

  visible = false;

  ngOnInit(): void {
    this.onScroll();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.visible = window.scrollY > REVEAL_AT_PX;
  }
}
