import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { CustomerAddress, SaveCustomerAddressRequest } from '../models/profile-extras.models';

/**
 * La libreta de direcciones del cliente. Port de `CustomerAddressRepository`.
 *
 * Ninguna cita apunta aquí: cada reserva guarda su copia, así que corregir o
 * borrar una dirección no cambia nada de lo ya reservado.
 */
@Injectable({ providedIn: 'root' })
export class AddressesRepository {
  private readonly api = inject(ApiService);

  /** Las guardadas, con la predeterminada primero (lo ordena el servidor). */
  async mine(): Promise<CustomerAddress[]> {
    return (await this.api.get<CustomerAddress[]>('/customers/me/addresses')) ?? [];
  }

  /** La primera nace como predeterminada, se pida o no. */
  create(req: SaveCustomerAddressRequest): Promise<CustomerAddress> {
    return this.api.post<CustomerAddress>('/customers/me/addresses', req);
  }

  update(id: number, req: SaveCustomerAddressRequest): Promise<CustomerAddress> {
    return this.api.put<CustomerAddress>(`/customers/me/addresses/${id}`, req);
  }

  delete(id: number): Promise<void> {
    return this.api.delete<void>(`/customers/me/addresses/${id}`);
  }
}
