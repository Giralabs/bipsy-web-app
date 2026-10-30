import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';

// ----- LÍMITES --------------------
// Los mismos que el backend (SupportTicketService.MAX_ATTACHMENTS y
// LocalPrivateFileStorage.MAX_SIZE) y que `support_models.dart`. Se validan
// también aquí para dar el error antes de gastar la subida.

export const MAX_TICKET_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Lo que acepta el selector de archivos: imágenes y los documentos del backend. */
export const TICKET_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.doc,.docx,.txt,.csv';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * El tipo de un archivo, o null si no se acepta. Del nombre y no de
 * `file.type`, que el navegador deja vacío para HEIC y para muchos `.csv`.
 */
export function ticketMimeOf(file: File): string | null {
  const dot = file.name.lastIndexOf('.');
  if (dot === -1) return null;
  return MIME_BY_EXTENSION[file.name.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * Tickets de soporte. Port de `SupportRepository` (gipsi_api).
 *
 * No hay lecturas: lo que se manda no se vuelve a leer en la web. El acuse
 * llega por correo con lo que se escribió, y por ahí se contesta.
 */
@Injectable({ providedIn: 'root' })
export class SupportRepository {
  private readonly api = inject(ApiService);

  /**
   * Crea el ticket y devuelve su id. Con [deferNotice] los correos no salen
   * todavía: se piden con [notify] cuando los adjuntos estén subidos, y así
   * la copia a soporte los lleva dentro.
   */
  async createTicket(req: { subject?: string; description: string; deferNotice?: boolean }): Promise<number> {
    const subject = req.subject?.trim();
    const res = await this.api.post<{ id: number }>('/support/tickets', {
      ...(subject ? { subject } : {}),
      description: req.description.trim(),
      kind: 'SUPPORT',
      ...(req.deferNotice ? { deferNotice: true } : {}),
    });
    return res.id;
  }

  /** Un archivo por petición: si uno falla, los demás ya subidos se quedan. */
  uploadAttachment(ticketId: number, file: File, contentType: string): Promise<unknown> {
    const form = new FormData();
    form.append('file', new File([file], file.name, { type: contentType }));
    return this.api.postMultipart(`/support/tickets/${ticketId}/attachments`, form);
  }

  /** Manda los correos de un ticket creado con `deferNotice`. El backend no los repite. */
  notify(ticketId: number): Promise<unknown> {
    return this.api.post(`/support/tickets/${ticketId}/notify`);
  }
}
