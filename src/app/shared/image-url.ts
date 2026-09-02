import { environment } from '../../environments/environment';

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
  const base = environment.apiUrl.replace(/\/$/, '');
  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
}

/**
 * Imagen de relleno estable por negocio. Port de `GipsiPlaceholderImages`.
 *
 * Estable a propósito: con una aleatoria, el mismo negocio cambiaba de foto
 * en cada recarga y la lista parecía otra.
 */
export function placeholderImage(businessId: number, categoryCode?: string | null): string {
  const code = (categoryCode ?? 'other').toLowerCase();
  return `https://picsum.photos/seed/gipsi-${code}-${businessId}/1600/900`;
}
