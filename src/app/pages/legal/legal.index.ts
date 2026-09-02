/**
 * Los documentos legales, solo por su nombre.
 *
 * Existe aparte de `legal.content.ts` porque el pie de página va en el
 * armazón de la app y se carga siempre: importando el contenido entero
 * metía 18 kB de texto legal en el bundle inicial para pintar dos enlaces.
 * El texto sigue viviendo en su página, que va en diferido.
 *
 * ⚠️ Al publicar un documento nuevo hay que añadirlo **aquí y en
 * `legal.content.ts`**. Es el precio de no cargar la prosa en la portada.
 */
import { LegalSlug } from './legal.models';

export interface LegalEntry {
  slug: LegalSlug;
  title: string;
}

/** Lo que exige la ley. Es la columna «Legal» del pie. */
export const LEGAL_INDEX: LegalEntry[] = [
  { slug: 'aviso-legal', title: 'Aviso legal' },
  { slug: 'terminos', title: 'Términos y condiciones' },
  { slug: 'privacidad', title: 'Política de privacidad' },
  { slug: 'cookies', title: 'Política de cookies' },
];

/**
 * Lo que no exige la ley pero hace falta igual.
 *
 * Van aparte de {@link LEGAL_INDEX} porque en el pie ocupan su propia columna:
 * meter «Contacto» debajo de «Política de cookies» lo esconde justo de quien
 * lo está buscando.
 */
export const HELP_INDEX: LegalEntry[] = [
  { slug: 'quienes-somos', title: 'Quiénes somos' },
  { slug: 'contacto', title: 'Contacto' },
  { slug: 'seguridad', title: 'Seguridad' },
];

/** Los dos grupos, para la navegación lateral de las propias páginas. */
export const LEGAL_GROUPS: { label: string; entries: LegalEntry[] }[] = [
  { label: 'Legal', entries: LEGAL_INDEX },
  { label: 'Ayuda', entries: HELP_INDEX },
];
