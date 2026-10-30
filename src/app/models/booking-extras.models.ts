/**
 * Lo que el flujo de reserva necesita y `bipsy.models.ts` todavía no tiene:
 * dónde se presta un servicio, la dirección a domicilio, la libreta de
 * direcciones y la de personas.
 *
 * Vive aparte para no tocar los modelos comunes mientras otras pantallas los
 * usan. Son extensiones: un `ServiceResponse` cualquiera sigue valiendo aquí, y
 * los campos nuevos son opcionales porque un backend anterior no los manda.
 *
 * Port de `GipsiServiceMode`, `GipsiBookingPlace`, `BookingAddress`,
 * `CustomerAddress` y `CustomerContact` (gipsi_api).
 */
import { CreateBookingRequest, ServiceResponse } from './bipsy.models';

/** Dónde se presta un SERVICIO: en el local, en casa del cliente o las dos. */
export type ServiceMode = 'AT_BUSINESS' | 'AT_CUSTOMER' | 'BOTH';

/**
 * Dónde se presta UNA CITA. Dos valores y no tres: una cita concreta ocurre en
 * un sitio y solo uno.
 */
export type BookingPlace = 'AT_BUSINESS' | 'AT_CUSTOMER';

/** El servicio tal y como lo manda el backend desde la V94. */
export interface BookableService extends ServiceResponse {
  /** El modo EN VIGOR, ya con lo que manda el negocio aplicado. */
  serviceMode?: ServiceMode;
  /** Lo que se cobra de más por ir a casa, en céntimos. Cero si no se desplaza. */
  homeSurchargeCents?: number;
}

/**
 * A dónde va el profesional. Misma forma que `AddressDto` del backend.
 *
 * `oneLine` solo llega en las respuestas: la compone el servidor para no
 * repetir en cada cliente la cuenta de no duplicar ciudad y provincia.
 */
export interface BookingAddress {
  address?: string;
  details?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  oneLine?: string;
}

/** Una dirección de la libreta del cliente (`GET /customers/me/addresses`). */
export interface CustomerAddress {
  id: number;
  label?: string | null;
  isDefault: boolean;
  address: BookingAddress;
}

/** Una persona de la libreta del cliente (`GET /customers/me/contacts`). */
export interface CustomerContact {
  id: number;
  name: string;
}

/** Sugerencia del buscador de direcciones (`GET /places/autocomplete`). */
export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText?: string;
}

/** Detalle de una sugerencia elegida (`GET /places/details`). */
export interface ResolvedAddress {
  address?: string;
  streetNumber?: string | null;
  formatted?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

/** `POST /bookings` con el sitio, la dirección y para quién es. */
export interface CreateBookingFullRequest extends CreateBookingRequest {
  servicePlace?: BookingPlace;
  address?: BookingAddress;
  attendeeContactId?: number;
}

/**
 * Lo que el backend manda del negocio y el tipo común todavía no recoge: si
 * tiene equipo y hasta dónde se desplaza.
 */
export interface BusinessBookingExtras {
  /** Con false atiende una sola persona: no hay profesional que resumir. */
  teamEnabled?: boolean;
  serviceAreaLatitude?: number | null;
  serviceAreaLongitude?: number | null;
  /** Null o cero = no ha declarado límite, y no se rechaza nada. */
  serviceRadiusKm?: number | null;
}

// ----- AYUDAS --------------------

/**
 * La dirección cae fuera de la zona que anuncia el negocio. Port de
 * `OutOfAreaNotice.applies`: solo con zona declarada y coordenadas que medir.
 * Una dirección escrita a mano no se puede medir, y ahí el servidor tampoco
 * rechaza nada.
 */
export function isOutOfArea(business: BusinessBookingExtras, a: BookingAddress | null | undefined): boolean {
  const lat = business.serviceAreaLatitude;
  const lng = business.serviceAreaLongitude;
  const radius = business.serviceRadiusKm ?? 0;
  if (radius <= 0 || lat == null || lng == null || a?.latitude == null || a.longitude == null) {
    return false;
  }
  return distanceKm(lat, lng, a.latitude, a.longitude) > radius;
}

/** Distancia en línea recta (haversine). Basta para avisar; decide el servidor. */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function visitsCustomer(service: BookableService | undefined): boolean {
  const mode = service?.serviceMode ?? 'AT_BUSINESS';
  return mode !== 'AT_BUSINESS';
}

export function hasVenue(service: BookableService | undefined): boolean {
  return (service?.serviceMode ?? 'AT_BUSINESS') !== 'AT_CUSTOMER';
}

/** El servicio deja elegir entre el local y el domicilio. */
export function needsPlaceChoice(service: BookableService | undefined): boolean {
  return service?.serviceMode === 'BOTH';
}

/**
 * Hace falta el paso «¿Dónde te atendemos?»: o hay que elegir, o hay que pedir
 * una dirección. Un servicio que solo se presta en el local se lo salta.
 */
export function needsPlaceStep(service: BookableService | undefined): boolean {
  return needsPlaceChoice(service) || visitsCustomer(service);
}

/** Lo que cuesta la cita de verdad, con el desplazamiento si lo hay. */
export function priceFor(service: BookableService, place: BookingPlace): number {
  const surcharge = place === 'AT_CUSTOMER' ? (service.homeSurchargeCents ?? 0) / 100 : 0;
  return service.price + surcharge;
}

/**
 * La dirección en una línea. Si el servidor la manda hecha, esa; si no, se
 * compone con el mismo criterio que `BookingAddress.oneLine` de la app.
 */
export function addressOneLine(a: BookingAddress | null | undefined): string {
  if (!a) {
    return '';
  }
  const fromServer = a.oneLine?.trim();
  if (fromServer) {
    return fromServer;
  }
  const street = [a.address, a.details].map(v => v?.trim() ?? '').filter(Boolean).join(', ');
  const zone = [a.postalCode?.trim(), a.city?.trim()].filter(Boolean).join(' ');
  const province = a.province?.trim();
  const withProvince = [
    zone,
    province && province.toLowerCase() !== (a.city ?? '').trim().toLowerCase() ? province : '',
  ].filter(Boolean).join(', ');
  return [street, withProvince].filter(Boolean).join(' · ');
}

/**
 * Lo mínimo que exige el servidor para una cita a domicilio: calle y ciudad.
 * Pedir lo mismo aquí es lo que evita un 400 en el último paso.
 */
export function isAddressReady(a: BookingAddress | null | undefined): boolean {
  return !!a && !!a.address?.trim() && !!a.city?.trim();
}
