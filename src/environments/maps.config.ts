/**
 * Clave de Google Maps para el navegador.
 *
 * ⚠️ **No sirve ninguna de las que ya hay.** La de las apps
 * (`android/local.properties`) está restringida por paquete y SHA-1, así que
 * un navegador nunca la va a poder usar; y la del backend
 * (`gipsi.maps-api-key`) es de servidor y **no puede salir de ahí** — puesta
 * en la web, cualquiera podría gastar cuota de Places a nuestra cuenta.
 *
 * Hay que crear una tercera, propia de la web:
 *   1. Google Cloud Console → APIs y servicios → Credenciales → Crear clave.
 *   2. Habilitar **Maps JavaScript API** en ese proyecto.
 *   3. Restringirla por **referente HTTP**: `localhost:*` y el dominio de la
 *      web. Sin esa restricción, la clave es pública y la gasta cualquiera.
 *
 * Es pública por diseño —viaja en el navegador—; lo que la protege es la
 * restricción por dominio, no el secreto.
 */
export const googleMapsApiKey = 'AIzaSyAwY1YNRKma7gzcCx1wgvoCqC-PKFLfdk8';

/**
 * Si se puede pintar el mapa.
 *
 * Sin clave, Buscar esconde el botón de mapa en lugar de enseñar un recuadro
 * roto: el mismo criterio que con Stripe, Firebase y los avisos push.
 */
export function isGoogleMapsConfigured(): boolean {
  return googleMapsApiKey.length > 0;
}

/**
 * Estilo del mapa. Copia literal de `GipsiMapStyle` (gipsi_shared_ui) para que
 * el mapa de la web y el de las apps sean el mismo.
 *
 * Google Maps **no sigue el tema**: sin esto, en modo oscuro entra un mapa
 * blanco a pantalla completa.
 */
export const MAP_STYLE_DARK: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#2e343b' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b5c3be' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#2e343b' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#f5f7f6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3f464e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7f8e89' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#454c54' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4e565f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b5c3be' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#252a30' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e565f' }] },
];

/**
 * Estilo claro: deja los colores de Google —que ya son claros— y solo apaga lo
 * que sobra.
 *
 * Sin esto el mapa mezcla dos cosas que no significan lo mismo: los negocios
 * de Bipsy, donde se puede reservar, y los que Google pinta por su cuenta,
 * donde no.
 */
export const MAP_STYLE_LIGHT: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
