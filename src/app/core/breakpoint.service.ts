import { Injectable, signal } from '@angular/core';

/** El mismo corte que `.only-desk` / `.only-touch` en styles.css. */
const DESKTOP_QUERY = '(min-width: 1025px)';

/**
 * Si se está en escritorio o en la «app» (móvil y tablet).
 *
 * `.only-desk` y `.only-touch` solo ESCONDEN: lo escondido se monta igual,
 * hace sus peticiones y descarga sus imágenes. En el móvil eso era la barra,
 * el buscador, el pie y el Bip del héroe; en escritorio, la tira de la tienda
 * y la barra de pestañas. Con esto, lo de un tamaño ni se crea en el otro.
 *
 * Las clases se quedan puestas: el primer pintado ya sale bien aunque la
 * señal tardara, y al girar una tablet no hay un instante con las dos cosas.
 */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly query = typeof matchMedia === 'function' ? matchMedia(DESKTOP_QUERY) : null;

  readonly desktop = signal(this.query?.matches ?? true);

  constructor() {
    this.query?.addEventListener('change', e => this.desktop.set(e.matches));
  }
}
