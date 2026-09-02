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

/** Los documentos publicados. Añadir uno obliga a tocar `legal.index.ts`. */
export type LegalSlug =
  | 'aviso-legal'
  | 'terminos'
  | 'privacidad'
  | 'cookies'
  | 'quienes-somos'
  | 'seguridad'
  | 'contacto';

export interface LegalDocument {
  slug: LegalSlug;
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
 * El prestador es una PERSONA FÍSICA, no una sociedad: `legalName` lleva el
 * nombre y los apellidos, y `taxId` el NIF. Es lo que exige el artículo 10 de
 * la LSSI-CE y no depende de estar dado de alta en ningún sitio: identificarse
 * y darse de alta son cosas distintas.
 *
 * Si algún día se constituye la sociedad, aquí cambian los tres valores y hay
 * que añadir los datos registrales al apartado 1 del aviso legal.
 *
 * Al rellenarlos: si Giralabs es una sociedad, `legalName` debe llevar la
 * denominación completa con su forma jurídica ("Giralabs S.L.", p. ej.); si se
 * opera como autónomo, el nombre y apellidos de la persona física.
 *
 * A 2026-09-02 no hay alta ninguna: ni sociedad ni autónomo. Mientras siga así
 * NO se puede publicar un aviso legal válido (no hay prestador al que
 * identificar) ni cobrar nada —ni las tarifas de cancelación, que ya están en
 * el código, ni las suscripciones—: Stripe pide identificación fiscal para
 * dejar de estar en modo prueba. Ver docs/LEGAL-PENDIENTE.md.
 */
export const LEGAL_COMPANY = {
  /** Nombre comercial, el que ve el usuario. */
  name: 'Giralabs',
  /** Titular real. Persona física mientras no haya sociedad. */
  legalName: 'José Ramón López Guisado',
  taxId: '49386987F',
  // Codigo postal comprobado con el geocodificador de Google, no de memoria.
  address: 'Calle Blas Infante 6, 41620 Marchena (Sevilla), España',
  // Un solo buzón a propósito: cinco direcciones que nadie lee son peores que
  // una que sí. El asunto encamina (ver la página de Contacto). Si algún día
  // se separan, se cambia aquí y los seis documentos se enteran solos.
  email: 'soporte@bipsy.es',
  privacyEmail: 'soporte@bipsy.es',
} as const;

/** True mientras falte algún dato obligatorio del prestador. */
export const LEGAL_COMPANY_INCOMPLETE =
  LEGAL_COMPANY.taxId.includes('PENDIENTE') ||
  LEGAL_COMPANY.address.includes('PENDIENTE');
