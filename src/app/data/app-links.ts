/**
 * Las fichas de las apps en las tiendas, en un único sitio.
 *
 * Estaban dentro del componente de la tira de descarga, y a la vez —apuntando a
 * YouTube, de una plantilla— en el pie y en la portada. Tres sitios para dos
 * URLs es la forma segura de que el día que existan se cambie uno y se queden
 * dos mintiendo.
 *
 * Son DOS apps y cada una tiene su ficha: la de cliente, que es la que anuncia
 * la web, y la de negocio, a la que manda la invitación de un trabajador
 * (`/equipo/:codigo` → `/descargar/negocio`).
 *
 * Cada tienda se enciende por separado: las dos apps se publicaron en la App
 * Store en noviembre de 2026 y Android llega unas semanas después. Mientras
 * [PLAY_STORE_READY] sea false, el botón de Google Play dice «Próximamente…»
 * y `/descargar` en Android dice «muy pronto». Un botón que da «no disponible»
 * es peor que no tenerlo.
 *
 * El día que salga Android, lo único que hay que tocar es PLAY_STORE_READY =
 * true. Los de Google Play salen del `applicationId` de cada app
 * (`android/app/build.gradle.kts`), que ya no puede cambiar tras la primera
 * subida.
 */

export type BipsyApp = 'customer' | 'business';

interface StoreListing {
  /** La ficha pública de la App Store (con el «Apple ID» de App Store Connect). */
  readonly appStore: string;
  /** El `applicationId` de Android. */
  readonly playPackage: string;
}

const LISTINGS: Readonly<Record<BipsyApp, StoreListing>> = {
  customer: {
    appStore: 'https://apps.apple.com/es/app/bipsy/id6828380156',
    playPackage: 'com.gipsi.gipsi',
  },
  business: {
    appStore: 'https://apps.apple.com/es/app/bipsy-business/id6828380398',
    playPackage: 'com.gipsi.gipsi_business',
  },
};

/** Las dos apps ya están publicadas en la App Store. */
export const APP_STORE_READY = true;
/** Android, todavía no: llega en unas semanas. */
export const PLAY_STORE_READY = false;
/** Si hay al menos una tienda publicada (para la tira de descarga y `/descargar`). */
export const STORE_LINKS_READY = APP_STORE_READY || PLAY_STORE_READY;

/** La página propia que reparte por tienda. Es a donde va todo mientras tanto. */
const DOWNLOAD_PAGE = 'https://bipsy.es/descargar';

/** La ficha de App Store. */
export function appStoreUrl(app: BipsyApp): string {
  return LISTINGS[app].appStore;
}

export function playStoreUrl(app: BipsyApp): string {
  return `https://play.google.com/store/apps/details?id=${LISTINGS[app].playPackage}`;
}

/** Los de la app de cliente, que es la que anuncian la tira, el pie y la portada. */
export const APP_STORE_URL = APP_STORE_READY ? appStoreUrl('customer') : DOWNLOAD_PAGE;
export const PLAY_STORE_URL = PLAY_STORE_READY ? playStoreUrl('customer') : DOWNLOAD_PAGE;

export type MobilePlatform = 'ios' | 'android' | 'other';

/**
 * El sistema del que visita, por el agente de usuario.
 *
 * El iPad moderno se anuncia como Macintosh y solo se delata por tener
 * puntos táctiles; sin esa comprobación se le mandaría a Google Play.
 */
export function mobilePlatformOf(userAgent: string, hasTouch: boolean): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && hasTouch)) {
    return 'ios';
  }
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

/**
 * La tienda a la que mandar a quien abre `/descargar` desde [platform], o ''
 * si todavía no hay ficha publicada o no se sabe qué sistema es.
 */
export function storeUrlFor(app: BipsyApp, platform: MobilePlatform): string {
  if (platform === 'ios' && APP_STORE_READY) return appStoreUrl(app);
  if (platform === 'android' && PLAY_STORE_READY) return playStoreUrl(app);
  return '';
}
