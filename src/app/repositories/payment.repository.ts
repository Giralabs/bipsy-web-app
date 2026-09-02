import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  PageResponse,
  PaymentConfig,
  PaymentMethodResponse,
  PaymentResponse,
} from '../models/bipsy.models';

/**
 * Tarjetas guardadas y cobros del cliente. Port de `PaymentRepository`.
 *
 * **El dinero lo recibe Bipsy, no el negocio**: no hay Stripe Connect y la
 * liquidación se hace fuera de la aplicación.
 *
 * Guardar una tarjeta son tres pasos porque el número nunca toca el backend:
 *   1. `createSetupIntent` devuelve el secreto del intent,
 *   2. la web lo confirma con el SDK de Stripe (ahí va la tarjeta),
 *   3. `registerMethod` guarda el método de pago resultante.
 */
@Injectable({ providedIn: 'root' })
export class PaymentRepository {
  private readonly api = inject(ApiService);

  config(): Promise<PaymentConfig> {
    return this.api.get<PaymentConfig>('/payments/config');
  }

  methods(): Promise<PaymentMethodResponse[]> {
    return this.api.get<PaymentMethodResponse[]>('/payments/methods');
  }

  async createSetupIntent(): Promise<string> {
    const res = await this.api.post<{ clientSecret: string }>('/payments/methods/setup-intent', {});
    return res.clientSecret;
  }

  registerMethod(paymentMethodId: string, keepSaved = true): Promise<PaymentMethodResponse> {
    return this.api.post<PaymentMethodResponse>('/payments/methods', { paymentMethodId, keepSaved });
  }

  setDefault(id: number): Promise<PaymentMethodResponse> {
    return this.api.put<PaymentMethodResponse>(`/payments/methods/${id}/default`, {});
  }

  deleteMethod(id: number): Promise<void> {
    return this.api.delete<void>(`/payments/methods/${id}`);
  }

  async history(page = 0, size = 20): Promise<PaymentResponse[]> {
    const res = await this.api.get<PaymentResponse[] | PageResponse<PaymentResponse>>(
      '/payments/history',
      { page, size },
    );
    return Array.isArray(res) ? res : (res?.content ?? []);
  }
}
