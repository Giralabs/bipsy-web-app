import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { ChatMessageResponse, ConversationResponse } from '../models/bipsy.models';

/**
 * Chat cliente ↔ negocio. Port de `ChatRepository`.
 *
 * ⚠️ **En la web no hay socket.** El canal en vivo de las apps autentica con
 * una cabecera `Authorization` en el handshake, y un navegador no puede poner
 * cabeceras en un WebSocket. Así que aquí todo va por REST y el hilo abierto
 * se refresca con un sondeo. Es el modo que la propia app contempla —"si el
 * socket está caído, el chat SIGUE funcionando; no hay un modo roto, hay un
 * modo sin actualización instantánea"—. Para tener empuje real en la web el
 * backend tendría que aceptar el token por subprotocolo o por query.
 */
@Injectable({ providedIn: 'root' })
export class ChatRepository {
  private readonly api = inject(ApiService);

  inbox(page = 0, size = 30): Promise<ConversationResponse[]> {
    return this.api.get<ConversationResponse[]>('/conversations', { page, size });
  }

  /** Total de no leídos para el globo. Una consulta agregada, no la suma. */
  async unreadCount(): Promise<number> {
    const res = await this.api.get<{ total?: number }>('/conversations/unread-count');
    return res?.total ?? 0;
  }

  conversation(id: number): Promise<ConversationResponse> {
    return this.api.get<ConversationResponse>(`/conversations/${id}`);
  }

  /** Abre el hilo con un negocio. Idempotente: si ya existe devuelve el mismo. */
  openWithBusiness(businessId: number): Promise<ConversationResponse> {
    return this.api.post<ConversationResponse>('/conversations', { businessId });
  }

  /**
   * Página del hilo, del más nuevo al más viejo.
   *
   * Se pagina por cursor (`beforeId`) y no por número de página porque en un
   * chat entran mensajes mientras se hace scroll, y con OFFSET se repetirían
   * o se saltarían.
   */
  history(conversationId: number, beforeId?: number, size = 30): Promise<ChatMessageResponse[]> {
    return this.api.get<ChatMessageResponse[]>(
      `/conversations/${conversationId}/messages`,
      { size, beforeId },
    );
  }

  send(conversationId: number, body: string, clientMessageId: string): Promise<ChatMessageResponse> {
    return this.api.post<ChatMessageResponse>(
      `/conversations/${conversationId}/messages`,
      { body, clientMessageId },
    );
  }

  sendAttachment(conversationId: number, file: File, clientMessageId: string): Promise<ChatMessageResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('clientMessageId', clientMessageId);
    return this.api.postMultipart<ChatMessageResponse>(
      `/conversations/${conversationId}/messages/attachment`,
      form,
    );
  }

  markRead(conversationId: number): Promise<void> {
    return this.api.put<void>(`/conversations/${conversationId}/read`, {});
  }

  /**
   * Descarga un adjunto y devuelve una URL de objeto.
   *
   * Hace falta este rodeo porque los adjuntos viven en el almacén privado y su
   * endpoint exige `Authorization`: un `<img src="…">` recibiría un 401.
   * Quien lo llame debe hacer `URL.revokeObjectURL` al terminar.
   */
  async attachmentObjectUrl(conversationId: number, messageId: number): Promise<string> {
    const blob = await this.api.getBlob(
      `/conversations/${conversationId}/messages/${messageId}/attachment`,
    );
    return URL.createObjectURL(blob);
  }
}
