/**
 * Icono de cada categoría de negocio, por su `code`.
 *
 * Port de `GipsiCategoryIcons` (gipsi_shared_ui). Vive aquí por lo mismo que
 * allí: el mismo icono aparece en los chips de la portada, en los de Buscar y
 * en el resumen de la reserva, y cada pantalla tenía su propia copia del
 * `switch` — la tijera era de peluquería en una y de barbería en otra.
 *
 * Los códigos desconocidos caen en la tienda genérica: la lista de categorías
 * la manda el servidor y puede crecer sin que se despliegue la web.
 */
const ICONS: Record<string, string> = {
  ALL: 'grid_view',
  HAIRDRESSER: 'face_retouching_natural',
  BARBER: 'content_cut',
  BARBERSHOP: 'content_cut',
  ESTHETIC: 'spa',
  NAILS: 'brush',
  MASSAGE: 'self_improvement',
  TATTOO: 'draw',
  MAKEUP: 'palette',
  EYEBROWS: 'remove_red_eye',
  PHYSIO: 'healing',
  PERSONAL_TRAINER: 'fitness_center',
  TUTORING: 'school',
  PILATES: 'accessibility_new',
  LASER: 'flash_on',
  NUTRITION: 'eco',
  PHOTOGRAPHY: 'camera_alt',
  COACHING: 'psychology',
};

export function categoryIcon(code?: string | null): string {
  return (code && ICONS[code]) || 'storefront';
}
