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
 * ⚠️ **Las fichas aún no están publicadas.** Mientras [STORE_LINKS_READY] sea
 * false, nada enlaza a una tienda: la tira y el pie llevan a `/descargar`, y
 * esa página dice «muy pronto». Un botón de App Store que da «no disponible»
 * es peor que no tenerlo.
 *
 * Al publicar, lo único que hay que tocar es STORE_LINKS_READY = true. Los
 * `appStoreId` ya están: son el «Apple ID» de App Store Connect ▸ la app ▸
 * Información de la app (fichas creadas el 29/10/2026, sin publicar todavía:
 * hasta entonces el enlace de la tienda contesta «no disponible»).
 *
 * Los de Google Play no hay que tocarlos: salen del `applicationId` de cada app
 * (`android/app/build.gradle.kts`), que ya no puede cambiar tras la primera
 * subida.
 */

export type BipsyApp = 'customer' | 'business';

interface StoreListing {
  /** El «Apple ID» numérico de App Store Connect. */
  readonly appStoreId: string;
  /** El `applicationId` de Android. */
  readonly playPackage: string;
}

const LISTINGS: Readonly<Record<BipsyApp, StoreListing>> = {
  customer: { appStoreId: '6828380156', playPackage: 'com.gipsi.gipsi' },
  business: { appStoreId: '6828380398', playPackage: 'com.gipsi.gipsi_business' },
};

/** Si las fichas ya están publicadas. Lo único que enciende los enlaces. */
export const STORE_LINKS_READY = false;

/** La página propia que reparte por tienda. Es a donde va todo mientras tanto. */
const DOWNLOAD_PAGE = 'https://bipsy.es/descargar';

/** La ficha de App Store, o '' si aún no se conoce su número. */
export function appStoreUrl(app: BipsyApp): string {
  const id = LISTINGS[app].appStoreId;
  return id ? `https://apps.apple.com/es/app/id${id}` : '';
}

export function playStoreUrl(app: BipsyApp): string {
  return `https://play.google.com/store/apps/details?id=${LISTINGS[app].playPackage}`;
}

/** Los de la app de cliente, que es la que anuncian la tira, el pie y la portada. */
export const APP_STORE_URL =
  STORE_LINKS_READY && appStoreUrl('customer') ? appStoreUrl('customer') : DOWNLOAD_PAGE;
export const PLAY_STORE_URL = STORE_LINKS_READY ? playStoreUrl('customer') : DOWNLOAD_PAGE;

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
  if (!STORE_LINKS_READY) return '';
  if (platform === 'ios') return appStoreUrl(app);
  if (platform === 'android') return playStoreUrl(app);
  return '';
}
