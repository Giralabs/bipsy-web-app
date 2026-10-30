import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { CustomerContact } from '../models/profile-extras.models';

/**
 * Las personas para las que el cliente pide cita. Port de
 * `CustomerContactRepository`. Solo nombres: la cita y el pago siguen siendo
 * del titular de la cuenta.
 */
@Injectable({ providedIn: 'root' })
export class ContactsRepository {
  private readonly api = inject(ApiService);

  async mine(): Promise<CustomerContact[]> {
    return (await this.api.get<CustomerContact[]>('/customers/me/contacts')) ?? [];
  }

  create(name: string): Promise<CustomerContact> {
    return this.api.post<CustomerContact>('/customers/me/contacts', { name });
  }

  update(id: number, name: string): Promise<CustomerContact> {
    return this.api.put<CustomerContact>(`/customers/me/contacts/${id}`, { name });
  }

  delete(id: number): Promise<void> {
    return this.api.delete<void>(`/customers/me/contacts/${id}`);
  }
}
