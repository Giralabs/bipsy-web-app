import { Component } from '@angular/core';

/** A dónde manda el botón según el teléfono. `null` = todavía no publicada. */
interface StoreTarget {
  label: string;
  url: string | null;
}

/**
 * Enlaces de tienda.
 *
 * ⚠️ **Los dos a null a propósito**: las fichas no existen todavía. Mientras lo
 * estén, el botón sale como «Próximamente» y no lleva a ningún sitio, que es
 * mejor que un botón de App Store que da un 404 —o que apunta a la búsqueda y
 * saca la app de otro—.
 *
 * Al publicar, poner aquí la URL y el botón se enciende solo:
 *   iOS      https://apps.apple.com/es/app/bipsy/id<APP_ID>
 *   Android  https://play.google.com/store/apps/details?id=<PACKAGE>
 */
const STORE_LINKS: Record<'ios' | 'android', string | null> = {
  ios: null,
  android: null,
};

/**
 * Tira de descarga de la app, como la que ponen X o Reddit.
 *
 * Solo en móvil y tablet: en un ordenador no hay app que instalar, y la tira
 * sería un anuncio de algo que no se puede usar.
 *
 * Detecta el sistema para enseñar la tienda que toca. Se apoya en el user
 * agent y no en el ancho: un iPad es tablet a 1024 px y a 1366, y lo que
 * decide a qué tienda mandar es el sistema, no el tamaño.
 */
@Component({
  selector: 'app-app-banner',
  standalone: true,
  templateUrl: './app-banner.component.html',
  styleUrl: './app-banner.component.css',
})
export class AppBannerComponent {
  /** Documentado en la política de cookies como preferencia de interfaz. */
  private static readonly STORAGE_KEY = 'bipsy_app_banner';

  dismissed = this.readDismissed();

  readonly store = this.detectStore();

  /** True mientras no haya ficha: el botón se enseña, pero no lleva a nada. */
  get comingSoon(): boolean {
    return this.store.url === null;
  }

  dismiss(): void {
    this.dismissed = true;
    try {
      localStorage.setItem(AppBannerComponent.STORAGE_KEY, 'hidden');
    } catch {
      // Navegación privada o almacenamiento bloqueado: se cierra en esta
      // sesión y reaparece en la siguiente. No es motivo para romper.
    }
  }

  private readDismissed(): boolean {
    try {
      return localStorage.getItem(AppBannerComponent.STORAGE_KEY) === 'hidden';
    } catch {
      return false;
    }
  }

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
      return { label: 'App Store', url: STORE_LINKS.ios };
    }
    return { label: 'Google Play', url: STORE_LINKS.android };
  }
}
