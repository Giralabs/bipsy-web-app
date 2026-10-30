/**
 * Lo que dicen las estrellas, en las dos hojas de valorar: la del detalle de
 * la cita y la de Reseñas. Port de `_labelForStars` (`review_sheet.dart`), en
 * un solo sitio para que las dos no acaben diciendo cosas distintas.
 */
export function reviewStarLabel(stars: number): string {
  switch (stars) {
    case 1: return 'Muy mala experiencia';
    case 2: return 'Mejorable';
    case 3: return 'Correcta';
    case 4: return 'Muy buena';
    case 5: return 'Excelente';
    default: return 'Toca para valorar';
  }
}

/** Sin estrellas el servidor la rechaza: se dice antes de mandarla. */
export const REVIEW_NEEDS_STARS = 'Elige al menos una estrella.';

/** Límite de `GipsiInputLimits.reviewComment` en la app. */
export const REVIEW_COMMENT_MAX = 500;
