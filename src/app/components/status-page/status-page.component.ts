import { Component, HostBinding, Input } from '@angular/core';
import { BipRigComponent } from '../bip-rig/bip-rig.component';

/** Las tres poses de Bip que hay en `public/assets_bip`. */
export type StatusMascot = 'hello' | 'support' | 'booking';

/**
 * El armazón de las pantallas de "aquí no hay web que enseñar": mantenimiento,
 * página no encontrada y error. Bip sobre su disco menta, un titular, una
 * frase y los botones.
 *
 * Solo pinta. No navega, no pregunta nada al servidor y no sabe por qué se la
 * enseña: eso lo decide la página que la usa, que le pasa los textos y
 * proyecta lo demás:
 *
 *  - contenido suelto → entre la frase y los botones (el aviso del equipo);
 *  - `statusActions`  → cada botón de la fila de acciones;
 *  - `statusNote`     → la nota pequeña del final.
 *
 * Son tres pantallas que se ven en los peores momentos de la web. Que salgan
 * de una misma pieza es lo que evita que cada una acabe con su propio margen.
 */
@Component({
  selector: 'app-status-page',
  standalone: true,
  imports: [BipRigComponent],
  templateUrl: './status-page.component.html',
  styleUrl: './status-page.component.css',
})
export class StatusPageComponent {
  @Input() mascot: StatusMascot = 'hello';
  /** La línea pequeña sobre el titular. Opcional. */
  @Input() eyebrow = '';
  /** `heading` y no `title`: un atributo `title` sale como globo al pasar el ratón. */
  @Input() heading = '';
  @Input() lead = '';

  /**
   * La pantalla es TODA la página, sin barra ni pie alrededor: ocupa el alto
   * entero y lleva la marca arriba, que es lo único que dice de quién es.
   */
  @HostBinding('class.status-page--full')
  @Input() fullPage = false;

  /**
   * El Bip de soporte es el único que está cortado en capas (`app-bip-rig`):
   * mantenimiento y los errores que lo usan lo enseñan animado por piezas.
   * Los otros dos siguen siendo su imagen fija.
   */
  get rigged(): boolean {
    return this.mascot === 'support';
  }

  get mascotSrc(): string {
    return `assets_bip/bip_${this.mascot}.webp`;
  }
}
