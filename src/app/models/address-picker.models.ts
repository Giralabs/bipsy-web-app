import { BookingAddress, isOutOfArea } from './booking-extras.models';

/**
 * La zona a la que se desplaza un negocio. Port de `ServiceArea` de la app.
 *
 * Tipo propio y no los tres campos sueltos: llega por dos puertas distintas —la
 * ficha del negocio en el flujo de reserva y el aviso de lista de espera— con
 * los mismos nombres, y el selector de direcciones solo necesita esto.
 */
export interface ServiceArea {
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  /** Null o cero = no ha declarado límite, y no se avisa de nada. */
  serviceRadiusKm?: number | null;
}

/** Si hay que avisar de que la dirección queda fuera. Delega en la cuenta común. */
export function outOfServiceArea(area: ServiceArea | null | undefined, a: BookingAddress | null | undefined): boolean {
  return !!area && isOutOfArea(area, a);
}

/** Franjas de la lista de espera, con los mismos cortes que el paso de hora. */
export type WaitlistTimeBand = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface WaitlistBandOption {
  band: WaitlistTimeBand;
  label: string;
  range: string;
}

/** Textos de `_bandLabel` y `_bandRange` de `waitlist_join_sheet.dart`. */
export const WAITLIST_BANDS: readonly WaitlistBandOption[] = [
  { band: 'MORNING', label: 'Mañana', range: 'Hasta las 14:00' },
  { band: 'AFTERNOON', label: 'Tarde', range: 'De 14:00 a 20:00' },
  { band: 'EVENING', label: 'Noche', range: 'A partir de las 20:00' },
];
