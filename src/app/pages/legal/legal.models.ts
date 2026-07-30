/**
 * Contenido de los documentos legales.
 *
 * Vive en TypeScript y no en HTML suelto para que la app móvil, la web y el
 * futuro panel muestren exactamente el mismo texto, y para poder versionarlo:
 * el backend guarda en `actor.terms_version` qué versión aceptó cada usuario,
 * así que al publicar un cambio de fondo hay que subir `version` aquí y pedir
 * la aceptación de nuevo.
 */
export interface LegalSection {
  /** Ancla para enlazar directamente a un apartado. */
  id: string;
  title: string;
  /** Cada string es un párrafo. Se renderizan como <p>. */
  paragraphs: string[];
  /** Lista de puntos opcional bajo los párrafos. */
  bullets?: string[];
}

export interface LegalDocument {
  slug: 'terminos' | 'privacidad';
  title: string;
  subtitle: string;
  /** Versión del documento. Debe coincidir con la que registra el backend. */
  version: string;
  /** Fecha de última actualización, en formato legible. */
  updatedAt: string;
  sections: LegalSection[];
}

/**
 * Datos de la empresa. Centralizados aquí porque aparecen en los dos
 * documentos y no deben poder divergir entre ellos.
 *
 * PENDIENTE: rellenar con los datos reales de Giralabs antes de publicar.
 */
export const LEGAL_COMPANY = {
  name: 'Giralabs',
  legalName: '[RAZÓN SOCIAL PENDIENTE]',
  taxId: '[CIF PENDIENTE]',
  address: '[DOMICILIO SOCIAL PENDIENTE]',
  email: 'soporte@gipsi-app.com',
  privacyEmail: 'privacidad@gipsi-app.com',
} as const;
