import { BookingResponse, BookingStatus, WaitlistOffer } from './bipsy.models';

/**
 * Lo que hace falta para las dos pantallas de «contesta antes de que se acabe
 * el plazo»: la cita que te pone el negocio y el aviso de hueco libre de la
 * lista de espera.
 *
 * Vive aparte de `bipsy.models.ts` a propósito: amplía sus tipos sin tocarlos,
 * para que el resto de la web siga compilando igual aunque aquí se añadan
 * campos.
 */

/**
 * El estado de una cita tal y como puede llegar al cliente.
 *
 * `AWAITING_CUSTOMER` es la que puso el NEGOCIO desde su agenda y espera que
 * el cliente la acepte, con un plazo corriendo (`confirmExpiresAt`). Es el
 * espejo del aviso de hueco: allí el cliente pide y el negocio ofrece; aquí el
 * negocio da la cita y el cliente dice que sí.
 */
export type CustomerBookingStatus = BookingStatus | 'AWAITING_CUSTOMER';

/**
 * La cita con los campos de confirmación que manda `GET /bookings/{id}`.
 *
 * El servidor los manda siempre; la web antigua solo los ignoraba. Se leen
 * aquí porque con diez minutos de plazo no se puede pedir la ficha del negocio
 * aparte para saber si hace falta tarjeta o política.
 */
export interface BookingToConfirm extends Omit<BookingResponse, 'status'> {
  status: CustomerBookingStatus;
  /**
   * Hasta cuándo se puede aceptar. **Instante en UTC** (con zona), al revés que
   * `startDateTime`: no es una hora del reloj del negocio, es un plazo. Null
   * salvo mientras la cita espera respuesta.
   */
  confirmExpiresAt?: string | null;
  /** La puso el negocio desde su agenda, no el cliente desde la app. */
  createdByBusiness?: boolean;
  /** Si al aceptarla hay que tener tarjeta guardada. Sin ella responde 402. */
  requiresCard?: boolean;
  /** Si al aceptarla hay que aceptar la política de cancelación. */
  requiresPolicyConsent?: boolean;
  /** La política ya redactada por el servidor, o null si no hay nada que aceptar. */
  policyText?: string | null;
}

/** Body de `PUT /bookings/{id}/customer-confirm`. */
export interface CustomerConfirmRequest {
  acceptedPolicy: boolean;
}

/**
 * El aviso de hueco con lo que `WaitlistOffer` todavía no recoge.
 *
 * `requiresCard` y `requiresAddress` son las dos preguntas que hay que saber
 * ANTES de pulsar «Quiero este hueco»: sin la primera, aceptar responde 402;
 * sin la segunda, 400. Con el plazo corriendo, enterarse por el error es
 * perder el hueco.
 */
export interface WaitlistOfferDetail extends WaitlistOffer {
  requiresCard?: boolean;
  requiresAddress?: boolean;
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  serviceRadiusKm?: number | null;
}

/** Dónde se atiende. Mismo enum que `BookingPlace` del backend. */
export type BookingPlace = 'AT_BUSINESS' | 'AT_CUSTOMER';

/** Dirección para un servicio a domicilio. Mismo contrato que `AddressDto`. */
export interface BookingAddress {
  address: string;
  details?: string;
  city: string;
  province?: string;
  postalCode?: string;
}

/** Body de `POST /waitlist/offers/{id}/accept`. */
export interface AcceptOfferRequest {
  acceptedPolicy: boolean;
  /** Solo cuando hace falta: en un servicio solo en el local sobra. */
  servicePlace?: BookingPlace;
  address?: BookingAddress;
}

/**
 * Si la cita espera a que el cliente la acepte.
 *
 * Recibe `{ status: string }` y no `BookingResponse` para poder usarse con las
 * citas de la lista, cuyo tipo todavía no conoce `AWAITING_CUSTOMER`.
 */
export function isAwaitingCustomer(booking: { status: string }): boolean {
  return booking.status === 'AWAITING_CUSTOMER';
}

/**
 * Cuánto queda, dicho como se diría: «2 horas», «5 minutos», «1 día».
 *
 * Port de `waitlistTimeLeft`. Redondea a la unidad grande y no da segundos:
 * una cifra que cambia cada segundo se lee peor y no ayuda a decidir.
 */
export function timeLeftLabel(ms: number): string {
  const minutesTotal = Math.floor(ms / 60_000);
  const hoursTotal = Math.floor(ms / 3_600_000);
  if (hoursTotal >= 24) {
    const days = Math.round(hoursTotal / 24);
    return days === 1 ? '1 día' : `${days} días`;
  }
  if (minutesTotal >= 60) {
    const hours = Math.round(minutesTotal / 60);
    return hours === 1 ? '1 hora' : `${hours} horas`;
  }
  if (minutesTotal >= 1) {
    return minutesTotal === 1 ? '1 minuto' : `${minutesTotal} minutos`;
  }
  return 'menos de un minuto';
}
