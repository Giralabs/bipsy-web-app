/**
 * Modelos de las libretas del cliente (direcciones y personas) y de sus
 * preferencias de avisos. Viven aparte de `bipsy.models.ts` porque solo los
 * usan los Ajustes; si la reserva a domicilio llega a la web, se pueden mover.
 *
 * Mismos campos que los DTO del backend (`CustomerDtos`, `AddressDtos`,
 * `NotificationPrefDtos`) y que los modelos de `gipsi_api`.
 */

/** `AddressDto`. `oneLine` solo llega de salida: el servidor la compone. */
export interface AddressFields {
  /** Calle y número. */
  address?: string | null;
  /** Piso, puerta, timbre: lo que hace falta para llamar. */
  details?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  oneLine?: string | null;
}

/** `CustomerAddressResponse`. */
export interface CustomerAddress {
  id: number;
  /** Cómo la llama el cliente: «Casa», «El piso de mi madre». Puede faltar. */
  label?: string | null;
  /** Sale ya elegida al reservar. Solo una por cliente. */
  isDefault: boolean;
  address: AddressFields;
}

/** Cuerpo de `POST` y `PUT /customers/me/addresses`. */
export interface SaveCustomerAddressRequest {
  label?: string;
  isDefault: boolean;
  address: AddressFields;
}

/** `CustomerContactResponse`: de un tercero solo se guarda el nombre. */
export interface CustomerContact {
  id: number;
  name: string;
}

/**
 * `NotificationPrefsResponse`. **Solo viaja lo apagado**: una clave que no
 * está en `muted` se manda. Así una clave nueva del servidor que esta web no
 * conoce sigue llegando sin que nadie la encienda.
 */
export interface NotificationPrefs {
  muted: string[];
}

/**
 * Las claves que pinta la web. ⚠️ Son un contrato con `NotifKeys.java`: si
 * una no existe allí, el `PUT` responde 400.
 */
export const CUSTOMER_NOTIF_KEYS = {
  bookingStateChange: 'notif_booking_state_change',
  chatMessage: 'notif_chat_message',
  waitlistOffer: 'notif_waitlist_offer',
  waitlistState: 'notif_waitlist_state',
  reviews: 'notif_customer_reviews',
} as const;

/** La dirección en una línea. La del servidor si llega; si no, compuesta igual que en la app. */
export function addressOneLine(a: AddressFields): string {
  const fromServer = a.oneLine?.trim();
  if (fromServer) {
    return fromServer;
  }
  const street = [a.address, a.details].map(e => e?.trim() ?? '').filter(Boolean).join(', ');
  const zone = [a.postalCode, a.city].map(e => e?.trim() ?? '').filter(Boolean).join(' ');
  const province = a.province?.trim() ?? '';
  const withProvince = [zone, province && province.toLowerCase() !== (a.city ?? '').trim().toLowerCase() ? province : '']
    .filter(Boolean)
    .join(', ');
  return [street, withProvince].filter(Boolean).join(' · ');
}

/** Título de la fila: su alias, o la propia calle si no le puso ninguno. */
export function addressTitle(a: CustomerAddress): string {
  const label = a.label?.trim() ?? '';
  if (label) {
    return label;
  }
  return a.address.address?.trim() || addressOneLine(a.address);
}

/**
 * Segunda línea: lo que el título no dice ya. Sin alias el título es la calle,
 * así que repetirla debajo dejaba la misma dirección dos veces.
 */
export function addressSubtitle(a: CustomerAddress): string {
  if (a.label?.trim()) {
    return addressOneLine(a.address);
  }
  const zone = [a.address.postalCode, a.address.city].map(e => e?.trim() ?? '').filter(Boolean).join(' ');
  return [a.address.details?.trim() ?? '', zone].filter(Boolean).join(' · ');
}
