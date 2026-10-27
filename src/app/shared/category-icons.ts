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
  BARBER: 'face',
  BARBERSHOP: 'face',
  HAIRDRESSER: 'content_cut',
  NAILS: 'brush',
  ESTHETIC: 'auto_awesome',
  EYEBROWS: 'visibility',
  TATTOO: 'draw',
  MAKEUP: 'palette',
  LASER: 'bolt',
  MASSAGE: 'massage',
  PERSONAL_TRAINER: 'exercise',
  PHYSIO: 'physical_therapy',
  PODIATRY: 'footprint',
  DENTAL: 'dentistry',
  NUTRITION: 'grocery',
  PSYCHOLOGY: 'psychology',
  PHOTOGRAPHY: 'photo_camera',
  PET_GROOMING: 'pet_supplies',
  OTHER: 'grid_view',
  // Apagadas desde la V119, pero los negocios que ya las tenían siguen saliendo con ellas.
  PILATES: 'accessibility_new',
  TUTORING: 'school',
  COACHING: 'track_changes',
};

export function categoryIcon(code?: string | null): string {
  return (code && ICONS[code]) || 'storefront';
}
