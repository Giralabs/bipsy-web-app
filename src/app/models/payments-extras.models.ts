import { PaymentMethodResponse, PaymentResponse } from './bipsy.models';
import { euros } from '../shared/dates';

/**
 * Lo que falta en `bipsy.models.ts` para el pago de la cita y las peticiones
 * de cobro del negocio. Port de `payment_models.dart` y `collect_models.dart`.
 */

// ----- ESTADOS DEL COBRO --------------------

/**
 * Todos los estados que manda el servidor.
 *
 * ⚠️ `AUTHORIZED` y `PARTIALLY_REFUNDED` existen y el tipo antiguo no los
 * tenía: caían en «Pendiente» y la web decía «pago pendiente» de un cobro que
 * sí se había hecho (lo mismo que mordió a la app). Si el servidor añade uno,
 * hay que añadirlo aquí y en `paymentStatusLabel`.
 */
export type PaymentStatusFull =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'SUCCEEDED'
  | 'REQUIRES_ACTION'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

/** Un cobro con todo lo que manda el servidor. */
export interface PaymentRecord extends Omit<PaymentResponse, 'status'> {
  status: PaymentStatusFull;
  /**
   * Lo ya devuelto de este cobro. Sin este número un cobro devuelto a medias
   * solo se puede contar a medias: es lo que dice cuánto se queda el negocio.
   */
  refundedCents?: number;
}

export type PaymentTone = 'success' | 'danger' | 'warn' | 'mint' | 'muted';

/** La etiqueta y el tono de cada estado, con las palabras de la app. */
export function paymentStatusLabel(status: PaymentStatusFull | string): { label: string; tone: PaymentTone } {
  switch (status) {
    case 'SUCCEEDED': return { label: 'Cobrado', tone: 'success' };
    case 'FAILED': return { label: 'No cobrado', tone: 'danger' };
    case 'REQUIRES_ACTION': return { label: 'Pendiente de tu banco', tone: 'warn' };
    case 'REFUNDED': return { label: 'Devuelto', tone: 'mint' };
    // Parte vuelve y parte no: decir solo «Devuelto» haría creer que se
    // recuperó todo, y es justo lo que pasa al cancelar una cita pagada.
    case 'PARTIALLY_REFUNDED': return { label: 'Devuelto en parte', tone: 'mint' };
    case 'AUTHORIZED': return { label: 'Reservado en tu tarjeta', tone: 'warn' };
    default: return { label: 'En curso', tone: 'muted' };
  }
}

/** Etiqueta de reserva por si el servidor no mandara descripción. */
export function paymentKindLabel(kind: string): string {
  switch (kind) {
    case 'RESCHEDULE_FEE': return 'Cambio de cita';
    case 'NO_SHOW_FEE': return 'No presentado';
    // Explícito y no por el `default`: cayendo al final se etiquetaba como
    // «Cancelación», que es justo lo contrario de lo que es.
    case 'BOOKING_PAYMENT': return 'Pago de la cita';
    default: return 'Cancelación';
  }
}

// ----- PRESUPUESTO Y PAGO DE LA CITA --------------------

/**
 * Qué se debe por una cita y si se puede pagar desde la web.
 *
 * Que no sea pagable tiene dos motivos muy distintos —el negocio no lo ofrece,
 * o ya está pagada—, por eso viajan el modo y los importes y no un booleano.
 */
export interface BookingQuote {
  bookingId: number;
  /** OFF, OPTIONAL o REQUIRED. */
  mode: string;
  payable: boolean;
  /** Sin pagar no hay cita. */
  required: boolean;
  amountCents: number;
  paidCents: number;
  dueCents: number;
  /**
   * Dinero RETENIDO en la tarjeta, sin cobrar: esperando a que el negocio
   * acepte. Para quien lo ve no es lo mismo «pagado» que «reservado».
   */
  heldCents?: number;
  publishableKey?: string | null;
  /**
   * Cuenta Connect del negocio. El cobro vive DENTRO de ella (direct charge),
   * así que Stripe.js no lo encuentra sin saber en qué cuenta mirar.
   */
  stripeAccountId?: string | null;
  hasSavedCard: boolean;
}

/** Se puede intentar cobrar: hace falta la cuenta del negocio y la clave. */
export function quoteUsable(quote: BookingQuote | null | undefined): quote is BookingQuote {
  return !!quote && quote.payable && !!quote.publishableKey && !!quote.stripeAccountId;
}

export function quoteIsHeld(quote: BookingQuote | null | undefined): boolean {
  return (quote?.heldCents ?? 0) > 0;
}

/**
 * Cómo quedó un intento de pago. `clientSecret` solo viene cuando falta que
 * lo termine el navegador: el reto del banco (3-D Secure).
 */
export interface BookingPaymentResult {
  status: string;
  clientSecret?: string | null;
  stripeAccountId?: string | null;
  amountCents: number;
  failureReason?: string | null;
}

/** Salió bien, cobrado o solo reservado: una retención también es un final. */
export function paymentDone(res: BookingPaymentResult): boolean {
  return res.status === 'SUCCEEDED' || res.status === 'AUTHORIZED';
}

export function paymentNeedsAction(res: BookingPaymentResult): boolean {
  return !!res.clientSecret;
}

// ----- PETICIÓN DE COBRO DEL NEGOCIO --------------------

/**
 * La petición de pago que el negocio le ha hecho al cliente al terminar la
 * cita. Trae el nombre del negocio y el concepto porque la hoja salta sin que
 * el cliente haya navegado a ningún sitio: sin saber quién cobra, sería una
 * petición de dinero anónima.
 */
export interface PendingPaymentRequest {
  id: number;
  bookingId: number;
  amountCents: number;
  /** `Instant` en UTC (`…Z`). */
  expiresAt: string;
  businessName: string;
  businessId: number;
  concept: string;
  bookingStartDateTime?: string | null;
}

export function requestIsLive(req: PendingPaymentRequest): boolean {
  return new Date(req.expiresAt).getTime() > Date.now();
}

// ----- TARJETAS --------------------

/** "04/27". Vacío si el servidor no tuviera la caducidad. */
export function cardExpiry(method: PaymentMethodResponse): string {
  if (!method.expMonth || !method.expYear) return '';
  return `${String(method.expMonth).padStart(2, '0')}/${String(method.expYear % 100).padStart(2, '0')}`;
}

/** Caducada al terminar el mes indicado. */
export function cardIsExpired(method: PaymentMethodResponse): boolean {
  if (!method.expMonth || !method.expYear) return false;
  // Mes siguiente al de caducidad, día 1: `expMonth` va de 1 a 12 y `Date`
  // cuenta de 0 a 11, así que el mismo número ya es el mes siguiente.
  return new Date(method.expYear, method.expMonth, 1).getTime() <= Date.now();
}

/** La predeterminada, y si ninguna lo es, la primera. */
export function defaultCard(methods: PaymentMethodResponse[]): PaymentMethodResponse | null {
  return methods.find(m => m.isDefault) ?? methods[0] ?? null;
}

/** Céntimos como importe: 1550 → "15,50 €". */
export function cents(value: number | null | undefined): string {
  return euros((value ?? 0) / 100);
}
