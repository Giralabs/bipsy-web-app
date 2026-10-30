import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  BookingAddress,
  CustomerAddress,
  CustomerContact,
  PlaceSuggestion,
  ResolvedAddress,
} from '../models/booking-extras.models';

/**
 * Lo que pide el flujo de reserva además de la cita: las dos libretas del
 * cliente (direcciones y personas) y el buscador de direcciones.
 *
 * Repositorio propio y no métodos sueltos en `BookingRepository`: son tres
 * recursos distintos del backend que solo se cruzan aquí, y así el de citas no
 * crece con cosas que no son citas.
 */
@Injectable({ providedIn: 'root' })
export class BookingExtrasRepository {
  private readonly api = inject(ApiService);

  // ----- DIRECCIONES --------------------

  /** La libreta, con la predeterminada primero (lo ordena el servidor). */
  async addresses(): Promise<CustomerAddress[]> {
    return (await this.api.get<CustomerAddress[]>('/customers/me/addresses')) ?? [];
  }

  /**
   * Guarda una dirección. El servidor exige lo mismo que al reservar —calle y
   * ciudad—, así que una que pasa la reserva también pasa aquí.
   */
  createAddress(address: BookingAddress, label?: string, isDefault = false): Promise<CustomerAddress> {
    return this.api.post<CustomerAddress>('/customers/me/addresses', {
      label: label ?? null,
      isDefault,
      address: stripOneLine(address),
    });
  }

  // ----- PERSONAS --------------------

  /** Las personas para quien se puede reservar, en orden alfabético. */
  async contacts(): Promise<CustomerContact[]> {
    return (await this.api.get<CustomerContact[]>('/customers/me/contacts')) ?? [];
  }

  createContact(name: string): Promise<CustomerContact> {
    return this.api.post<CustomerContact>('/customers/me/contacts', { name });
  }

  // ----- BUSCADOR --------------------

  /**
   * Sugerencias mientras se escribe.
   *
   * `sessionToken` se mantiene durante una búsqueda y se cambia al elegir:
   * Google factura la sesión entera como una sola consulta.
   */
  async autocomplete(query: string, sessionToken: string): Promise<PlaceSuggestion[]> {
    const res = await this.api.get<{ suggestions?: PlaceSuggestion[] }>('/places/autocomplete', {
      q: query,
      sessionToken,
    });
    return res?.suggestions ?? [];
  }

  placeDetails(placeId: string, sessionToken: string): Promise<ResolvedAddress> {
    return this.api.get<ResolvedAddress>('/places/details', { placeId, sessionToken });
  }
}

/** `oneLine` es solo de salida: el servidor lo ignora, mejor no mandarlo. */
export function stripOneLine(address: BookingAddress): BookingAddress {
  const { oneLine: _ignored, ...rest } = address;
  return rest;
}
