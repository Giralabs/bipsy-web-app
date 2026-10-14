import { Component } from '@angular/core';
import { APP_STORE_URL, PLAY_STORE_URL, STORE_LINKS_READY } from '../../data/app-links';

/** A dónde manda el botón según el teléfono. */
interface StoreTarget {
  label: string;
  url: string;
}

/**
 * Tira de descarga de la app, como la que ponen X o Reddit.
 *
 * **Se pinta siempre y no se puede cerrar.** Es el único sitio donde alguien que
 * ha entrado por el enlace de un negocio —y que puede reservar ahí mismo, sin
 * instalarse nada— se encuentra la invitación a tener la app. Antes se podía
 * descartar y se guardaba en `localStorage`; ahora el aviso se queda, porque
 * quien reserva en la web es justamente a quien hay que decírselo.
 *
 * Solo en móvil y tablet: en un ordenador no hay app que instalar, y la tira
 * sería un anuncio de algo que no se puede usar. Lo decide `app.component.html`
 * con `.only-touch`.
 *
 * Detecta el sistema para enseñar la tienda que toca. Se apoya en el user
 * agent y no en el ancho: un iPad es tablet a 1024 px y a 1366, y lo que
 * decide a qué tienda mandar es el sistema, no el tamaño.
 *
 * ⚠️ Mientras las fichas no existan (`STORE_LINKS_READY`), el botón dice
 * «Próximamente» y no navega. Ver `data/app-links.ts`.
 */
@Component({
  selector: 'app-app-banner',
  standalone: true,
  templateUrl: './app-banner.component.html',
  styleUrl: './app-banner.component.css',
})
export class AppBannerComponent {
  readonly store = this.detectStore();

  /** Si el botón lleva de verdad a una tienda. Ver `data/app-links.ts`. */
  readonly linkReady = STORE_LINKS_READY;

  /**
   * Qué tienda toca.
   *
   * El iPad moderno se anuncia como Macintosh y solo se delata por tener
   * puntos táctiles; sin esa comprobación, un iPad vería el botón de Google
   * Play. Cuando no se puede saber, Google Play: es la tienda del sistema con
   * más cuota y el enlace funciona igual desde un navegador de escritorio.
   */
  private detectStore(): StoreTarget {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const isIpad = /Macintosh/.test(ua) && typeof document !== 'undefined'
      && 'ontouchend' in document;

    if (/iPhone|iPad|iPod/.test(ua) || isIpad) {
      return { label: 'App Store', url: APP_STORE_URL };
    }
    return { label: 'Google Play', url: PLAY_STORE_URL };
  }
}
