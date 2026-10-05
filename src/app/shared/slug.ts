import { BusinessResponse } from '../models/bipsy.models';

/** Lo mínimo de un negocio para construir su dirección. */
type BusinessRef = { id: number; name?: string; slug?: string };

/**
 * Parte de la URL de un negocio: `/negocio/barberia-el-maestro`.
 *
 * Es el slug que fija el backend al crear el negocio y que no cambia al
 * renombrarlo: acaba impreso en códigos QR. Sin él —listas que solo traen el
 * id y el nombre, como las citas— se cae al formato antiguo `nombre-id`, que
 * `resolveBusiness` sigue entendiendo.
 */
export function businessSlug(business: BusinessRef): string {
  if (business.slug) {
    return business.slug;
  }
  const name = slugify(business.name ?? '');
  return name ? `${name}-${business.id}` : String(business.id);
}

/** Los segmentos de ruta para `routerLink` y `router.navigate`. */
export function businessPath(business: BusinessRef): string[] {
  return ['/negocio', businessSlug(business)];
}

/** Los del flujo de reserva de ese negocio. */
export function businessBookingPath(business: BusinessRef): string[] {
  return ['/negocio', businessSlug(business), 'reservar'];
}

/** El enlace que se comparte, con el origen de la web en la que se está. */
export function businessShareUrl(origin: string, business: BusinessRef): string {
  return `${origin}/negocio/${businessSlug(business)}`;
}

/**
 * Saca el id de un parámetro de ruta.
 *
 * Solo para los enlaces antiguos: acepta `barberia-el-maestro-3` y `3`. Los
 * actuales llevan el slug y se resuelven por él (ver `resolveBusiness`).
 */
export function businessIdFromParam(param: string | null): number | null {
  if (!param) {
    return null;
  }
  const match = param.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Nombre a texto de URL: sin tildes, sin eñes y sin signos.
 *
 * `normalize('NFD')` separa la letra de su tilde y el rango de bloque las
 * borra: es lo que convierte "Barbería" en "barberia" sin una tabla de
 * sustituciones escrita a mano.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
