import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/**
 * Título de la pestaña y `noindex` para las pantallas que no son contenido:
 * mantenimiento, acceso del equipo, página no encontrada y errores.
 *
 * El resto de la web vive con el título de `index.html`, así que quien cambia
 * algo aquí tiene que devolverlo al irse. Por eso [set] entrega la función que
 * lo deshace.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** El de `index.html`, leído antes de que nadie lo toque. */
  private readonly defaultTitle = this.title.getTitle();

  /** A quién pertenece lo que hay puesto ahora mismo. */
  private owner = 0;

  /**
   * Pone el título y, si se pide, `noindex`. Devuelve cómo deshacerlo.
   *
   * Deshacer no hace nada si entretanto otra pantalla ha puesto lo suyo: al
   * cambiar de una a otra, la que se va se destruye a veces después de que la
   * nueva haya llegado, y sin esto le borraba el título.
   */
  set(title: string, noindex = false): () => void {
    const ticket = ++this.owner;
    this.title.setTitle(`${title} · Bipsy`);
    if (noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
    } else {
      this.meta.removeTag('name="robots"');
    }

    return () => {
      if (this.owner !== ticket) {
        return;
      }
      this.title.setTitle(this.defaultTitle);
      this.meta.removeTag('name="robots"');
    };
  }
}
