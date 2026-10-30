import { resolveApiUrl } from '../core/api.service';

/**
 * Reescritura de las URL de imagen. Port de `GipsiImageUrl`.
 *
 * El backend devuelve rutas relativas (`/files/business-cover/….webp`) y a
 * veces absolutas contra su propio host. Aquí se resuelven contra la API
 * configurada: con `http://localhost:8080` escrito a mano, la web funcionaba
 * en el portátil de quien la escribió y en ningún otro sitio.
 */
export function fixImageUrl(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
    return value;
  }
  // La misma base que `ApiService`: si no, servida desde localhost la API iba
  // al backend local y las fotos al remoto.
  const base = resolveApiUrl().replace(/\/$/, '');
  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
}

// Ya no hay imagen de relleno. Se pedía a `picsum.photos` y hacía que un
// negocio sin portada enseñara como suya la foto de un tercero —y bajaba una
// foto de 1600×900 por cada tarjeta—. Donde falta la foto se pinta el hueco de
// marca `.img-placeholder` (styles.css), port de `GipsiImagePlaceholder`.
