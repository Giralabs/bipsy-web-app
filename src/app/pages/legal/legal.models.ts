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
  /**
   * Párrafos que van DESPUÉS de la lista. Sin esto, todo el texto de una
   * sección con puntos tendría que ir antes de ellos, y hay apartados que
   * necesitan cerrar tras enumerar (p. ej. las penalizaciones de reserva).
   */
  closingParagraphs?: string[];
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
 * `taxId` y `address` siguen sin rellenar A PROPÓSITO: la LSSI-CE obliga a que
 * el aviso legal identifique correctamente al prestador del servicio, así que
 * tienen que ser los reales y no una aproximación. Mientras contengan
 * "PENDIENTE" la página muestra el aviso de arriba.
 *
 * Al rellenarlos: si Giralabs es una sociedad, `legalName` debe llevar la
 * denominación completa con su forma jurídica ("Giralabs S.L.", p. ej.); si se
 * opera como autónomo, el nombre y apellidos de la persona física.
 */
export const LEGAL_COMPANY = {
  /** Nombre comercial, el que ve el usuario. */
  name: 'Giralabs',
  /** Denominación social con su forma jurídica. */
  legalName: 'Giralabs',
  taxId: '[CIF PENDIENTE]',
  address: '[DOMICILIO SOCIAL PENDIENTE]',
  email: 'soporte@gipsi-app.com',
  privacyEmail: 'privacidad@gipsi-app.com',
} as const;

/** True mientras falte algún dato obligatorio del prestador. */
export const LEGAL_COMPANY_INCOMPLETE =
  LEGAL_COMPANY.taxId.includes('PENDIENTE') ||
  LEGAL_COMPANY.address.includes('PENDIENTE');
