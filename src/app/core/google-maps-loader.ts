import { googleMapsApiKey, isGoogleMapsConfigured } from '../../environments/maps.config';

export { isGoogleMapsConfigured };

declare const google: any;

/** Una sola carga del SDK por pestaña, aunque lo pidan varios componentes. */
let mapsLoader: Promise<void> | null = null;

/**
 * Google avisa por aquí cuando rechaza la clave —caducada, sin la Maps
 * JavaScript API habilitada, o el dominio fuera de la lista de referentes—. Es
 * lo único que lo cuenta: el `<script>` carga bien y el error solo sale por la
 * consola.
 */
let authFailed = false;

/** Nombre del callback global con el que Google avisa de que ya está listo. */
const READY_CALLBACK = '__bipsyMapsReady';

/** True si Google ha rechazado la clave. Solo se sabe después de intentarlo. */
export function googleMapsAuthFailed(): boolean {
  return authFailed;
}

/**
 * Carga el SDK de Google Maps una sola vez.
 *
 * ⚠️ **Con `callback` y no con el `onload` del `<script>`.**
 *
 * El `onload` salta cuando ha llegado el fichero, no cuando el SDK está
 * montado: ahí `google.maps.Map` todavía no existe y crear el mapa lanza. Y
 * `importLibrary` tampoco vale: eso solo lo deja preparado el cargador en línea
 * de Google, no un `<script src>` normal — se probó y venía `undefined`. El
 * callback es la vía que sí garantiza el espacio de nombres completo.
 */
export function loadGoogleMaps(): Promise<void> {
  if (mapsLoader) {
    return mapsLoader;
  }
  mapsLoader = new Promise<void>((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps?.Map) {
      resolve();
      return;
    }

    const scope = window as unknown as Record<string, unknown>;
    scope['gm_authFailure'] = () => {
      authFailed = true;
    };
    scope[READY_CALLBACK] = () => resolve();

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}` +
      `&language=es&region=ES&v=weekly&callback=${READY_CALLBACK}`;
    script.async = true;
    script.onerror = () => reject(new Error('No se ha podido cargar Google Maps'));
    document.head.appendChild(script);
  });
  return mapsLoader;
}

/** Un sitio elegido por el usuario, ya resuelto a coordenadas. */
export interface ResolvedPlace {
  label: string;
  lat: number;
  lng: number;
}

/**
 * Convierte lo que el usuario escribe en coordenadas.
 *
 * Restringido a España porque es donde opera Bipsy: sin eso, «Marchena»
 * devuelve antes un municipio de Colombia que el de Sevilla.
 *
 * Devuelve lista vacía si Google no encuentra nada; **lanza** si el SDK no
 * carga o la clave está rechazada, para que quien llame pueda ofrecer la
 * alternativa de buscar por texto.
 */
export async function geocodeAddress(address: string): Promise<ResolvedPlace[]> {
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();
  const response = await geocoder.geocode({
    address,
    componentRestrictions: { country: 'ES' },
  });
  return (response.results ?? []).slice(0, 5).map((result: any) => ({
    label: result.formatted_address as string,
    lat: result.geometry.location.lat() as number,
    lng: result.geometry.location.lng() as number,
  }));
}

/**
 * El nombre legible de unas coordenadas, para enseñar «Marchena, Sevilla» en
 * lugar de dos números después de pulsar «usar mi ubicación».
 *
 * Si falla devuelve null en vez de lanzar: la ubicación ya la tenemos y la
 * búsqueda funciona igual sin saber cómo se llama el sitio.
 */
export async function describeCoordinates(lat: number, lng: number): Promise<string | null> {
  try {
    await loadGoogleMaps();
    const geocoder = new google.maps.Geocoder();
    const response = await geocoder.geocode({ location: { lat, lng } });
    const results: any[] = response.results ?? [];
    if (!results.length) return null;

    // La localidad antes que la dirección exacta: para elegir zona de búsqueda
    // «Marchena, Sevilla» dice más que «Calle Blas Infante 6, 41620…».
    const locality = results.find((r: any) =>
      (r.types ?? []).some((t: string) => t === 'locality' || t === 'postal_town'),
    );
    return (locality ?? results[0]).formatted_address ?? null;
  } catch {
    return null;
  }
}
