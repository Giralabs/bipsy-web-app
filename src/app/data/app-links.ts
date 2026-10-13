/**
 * Los enlaces a las tiendas, en un único sitio.
 *
 * Estaban dentro del componente de la tira de descarga, y a la vez —apuntando a
 * YouTube, de una plantilla— en el pie y en la portada. Tres sitios para dos
 * URLs es la forma segura de que el día que existan se cambie uno y se queden
 * dos mintiendo.
 *
 * ⚠️ **Son PLACEHOLDERS: las fichas de las tiendas no existen todavía.** Mientras
 * [STORE_LINKS_READY] sea false, la tira se pinta igual —el aviso de instalar la
 * app tiene que estar siempre— pero el botón no navega a ningún sitio: dice
 * «Próximamente». Un botón de App Store que da un 404, o que lleva a una
 * búsqueda y saca la app de otro, es peor que no tenerlo.
 *
 * Al publicar, esto es todo lo que hay que tocar:
 *
 *   APP_STORE_URL  = 'https://apps.apple.com/es/app/bipsy/id<APP_ID>'
 *   PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.gipsi.gipsi'
 *   STORE_LINKS_READY = true
 *
 * El mismo criterio que `hayEnlaceDeDescarga` en la app de negocio: no se
 * comparte ni se promete una descarga que no existe.
 */

export const APP_STORE_URL = 'https://bipsy.es/descargar';
export const PLAY_STORE_URL = 'https://bipsy.es/descargar';

/** Si las fichas ya están publicadas. Lo único que enciende los enlaces. */
export const STORE_LINKS_READY = false;
