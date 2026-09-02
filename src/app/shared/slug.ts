import { BusinessResponse } from '../models/bipsy.models';

/**
 * URL legible de un negocio: `/business/barberia-el-maestro-3`.
 *
 * **El id va al final y es lo único que se lee.** El nombre está para que la
 * dirección se entienda al verla y al compartirla, pero no se usa para
 * resolver nada: si el negocio se renombra, el enlace antiguo sigue abriendo
 * la ficha correcta en vez de dar un 404.
 */
export function businessSlug(business: { id: number; name?: string }): string {
  const name = slugify(business.name ?? '');
  return name ? `${name}-${business.id}` : String(business.id);
}

/** Los segmentos de ruta para `routerLink` y `router.navigate`. */
export function businessPath(business: { id: number; name?: string }): string[] {
  return ['/business', businessSlug(business)];
}

/** Los del flujo de reserva de ese negocio. */
export function businessBookingPath(business: { id: number; name?: string }): string[] {
  return ['/business', businessSlug(business), 'reservar'];
}

/**
 * Saca el id de un parámetro de ruta.
 *
 * Acepta tanto `barberia-el-maestro-3` como `3`, porque los enlaces viejos —y
 * cualquiera que teclee la ruta a mano— tienen que seguir funcionando.
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
