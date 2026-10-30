import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  PageResponse,
  PaymentConfig,
  PaymentMethodResponse,
} from '../models/bipsy.models';
import {
  BookingPaymentResult,
  BookingQuote,
  PaymentRecord,
  PendingPaymentRequest,
} from '../models/payments-extras.models';

/**
 * Tarjetas guardadas y cobros del cliente. Port de `PaymentRepository` y de
 * la parte de cliente de `CollectRepository`.
 *
 * Hay dos clases de dinero y viven en sitios distintos:
 *  - Las **tarifas** (cancelar tarde, no presentarse) y las tarjetas guardadas
 *    son de la cuenta de Bipsy.
 *  - El **pago de la cita** es un *direct charge* en la cuenta Connect del
 *    negocio. Por eso el presupuesto trae su `stripeAccountId`: sin él,
 *    Stripe.js no encuentra el cobro para pasar el 3-D Secure.
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

  async history(page = 0, size = 20): Promise<PaymentRecord[]> {
    const res = await this.api.get<PaymentRecord[] | PageResponse<PaymentRecord>>(
      '/payments/history',
      { page, size },
    );
    return Array.isArray(res) ? res : (res?.content ?? []);
  }

  /**
   * El último cobro de una cita, o null (204) si no hubo ninguno.
   *
   * Se pide justo después de cancelar con tarifa: el cargo se crea en la misma
   * transacción, y es lo único que dice si el banco lo aceptó de verdad.
   */
  async forBooking(bookingId: number): Promise<PaymentRecord | null> {
    return (await this.api.get<PaymentRecord | null>(`/payments/booking/${bookingId}`)) ?? null;
  }

  /** Qué se debe por una cita y si se puede pagar ahora. */
  bookingQuote(bookingId: number): Promise<BookingQuote> {
    return this.api.get<BookingQuote>(`/payments/booking/${bookingId}/quote`);
  }

  /**
   * Paga la cita con una tarjeta guardada.
   *
   * El id es el NUESTRO (el de `/payments/methods`), en texto: es lo que
   * espera `PayBookingRequest`. Si el banco pide 3-D Secure la respuesta trae
   * `clientSecret` y lo termina el navegador; después se vuelve a llamar aquí y
   * el servidor le pregunta a Stripe cómo quedó, sin esperar al webhook.
   */
  payBooking(bookingId: number, paymentMethodId: number): Promise<BookingPaymentResult> {
    return this.api.post<BookingPaymentResult>(`/payments/booking/${bookingId}`, {
      paymentMethodId: String(paymentMethodId),
    });
  }

  /**
   * La petición de cobro que el negocio tiene en pie, o null. El 204 es la
   * respuesta normal: casi siempre no hay nada que pagar.
   */
  async pendingRequest(): Promise<PendingPaymentRequest | null> {
    return (await this.api.get<PendingPaymentRequest | null>('/payments/requests/pending')) ?? null;
  }
}
