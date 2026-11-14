import { Component } from '@angular/core';
import {
  APP_STORE_READY,
  APP_STORE_URL,
  PLAY_STORE_READY,
  PLAY_STORE_URL,
  mobilePlatformOf,
} from '../../data/app-links';

/** A dónde manda el botón según el teléfono. */
interface StoreTarget {
  label: string;
  url: string;
  /** Si esa tienda ya tiene la ficha publicada. */
  ready: boolean;
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
 * ⚠️ Si la tienda de ese sistema aún no tiene ficha (hoy, Google Play), la
 * tira no se pinta. Ver `data/app-links.ts`.
 */
@Component({
  selector: 'app-app-banner',
  standalone: true,
  templateUrl: './app-banner.component.html',
  styleUrl: './app-banner.component.css',
})
export class AppBannerComponent {
  readonly store = this.detectStore();

  /**
   * Si el botón lleva de verdad a una tienda: cada sistema la suya. En iPhone,
   * ya; en Android, cuando se publique (`PLAY_STORE_READY`). Mientras tanto la
   * tira no se enseña. Ver `data/app-links.ts`.
   */
  readonly linkReady = this.store.ready;

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
    const hasTouch = typeof document !== 'undefined' && 'ontouchend' in document;

    if (mobilePlatformOf(ua, hasTouch) === 'ios') {
      return { label: 'App Store', url: APP_STORE_URL, ready: APP_STORE_READY };
    }
    return { label: 'Google Play', url: PLAY_STORE_URL, ready: PLAY_STORE_READY };
  }
}
