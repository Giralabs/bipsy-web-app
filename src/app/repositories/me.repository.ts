import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { CustomerProfile, MeResponse, PrivacySettings } from '../models/bipsy.models';

/** Cuerpo de `PUT /customers/me`. El usuario no es editable desde aquí. */
export interface UpdateCustomerRequest {
  name: string;
  email: string;
  phone: string;
}

/** La cuenta: quién soy, mis datos, mi contraseña y mis favoritos. */
@Injectable({ providedIn: 'root' })
export class MeRepository {
  private readonly api = inject(ApiService);

  /** Respuesta polimórfica según rol. */
  me(): Promise<MeResponse> {
    return this.api.get<MeResponse>('/me');
  }

  /** El perfil del cliente, con foto y favoritos. */
  customer(): Promise<CustomerProfile> {
    return this.api.get<CustomerProfile>('/customers/me');
  }

  updateCustomer(req: UpdateCustomerRequest): Promise<CustomerProfile> {
    return this.api.put<CustomerProfile>('/customers/me', req);
  }

  uploadPhoto(file: File): Promise<CustomerProfile> {
    const form = new FormData();
    form.append('file', file);
    return this.api.postMultipart<CustomerProfile>('/customers/me/image', form);
  }

  deletePhoto(): Promise<CustomerProfile> {
    return this.api.delete<CustomerProfile>('/customers/me/image');
  }

  /**
   * Solo cuentas con contraseña propia. Con `hasPassword: false` el servidor
   * responde 400, así que la pantalla esconde la opción en vez de ofrecerla.
   */
  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.api.post<void>('/me/change-password', { currentPassword, newPassword });
  }

  revokeAllSessions(): Promise<void> {
    return this.api.post<void>('/me/revoke-all-sessions', {});
  }

  privacy(): Promise<PrivacySettings> {
    return this.api.get<PrivacySettings>('/me/privacy');
  }

  /** Manda el estado completo, no un parche. */
  updatePrivacy(settings: PrivacySettings): Promise<PrivacySettings> {
    return this.api.put<PrivacySettings>('/me/privacy', settings);
  }

  /** Baja de la cuenta. Borrado lógico: el negocio conserva sus citas. */
  deleteAccount(): Promise<void> {
    return this.api.delete<void>('/customers/me');
  }

  // ----- FAVORITOS --------------------
  //
  // Los ids viven dentro del perfil; añadir y quitar devuelven el perfil ya
  // actualizado, así que no hace falta releerlo después.

  addFavoriteBusiness(businessId: number): Promise<CustomerProfile> {
    return this.api.put<CustomerProfile>(`/customers/me/favorites/businesses/${businessId}`, {});
  }

  removeFavoriteBusiness(businessId: number): Promise<CustomerProfile> {
    return this.api.delete<CustomerProfile>(`/customers/me/favorites/businesses/${businessId}`);
  }
}
