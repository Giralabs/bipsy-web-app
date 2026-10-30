import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_TICKET_ATTACHMENTS,
  SupportRepository,
  TICKET_ACCEPT,
  ticketMimeOf,
} from '../../repositories/support.repository';
import { ButtonComponent } from '../../components/button/button.component';
import { LEGAL_COMPANY } from '../legal/legal.models';

interface Pending {
  file: File;
  type: string;
}

/**
 * Soporte. Port de `SupportScreen` + `GipsiNewTicketScreen` de la app de
 * cliente, en una sola página: en la web cabe el formulario debajo del
 * correo y no hace falta una pantalla más.
 *
 * Abrir un ticket necesita cuenta —el acuse va a su correo—; sin ella queda
 * el correo, que no pide nada. Sin teléfono: esa línea es la de negocios.
 */
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class SupportComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly support = inject(SupportRepository);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = LEGAL_COMPANY.email;
  readonly accept = TICKET_ACCEPT;
  readonly maxFiles = MAX_TICKET_ATTACHMENTS;

  signedIn = false;
  sessionKnown = false;

  subject = '';
  description = '';
  files: Pending[] = [];

  sending = false;
  progress: string | null = null;
  error: string | null = null;
  /** Lo que no subió, para decirlo en el agradecimiento. */
  failedFiles: string[] = [];
  sent = false;
  copied = false;

  ngOnInit(): void {
    this.session.status$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(status => {
        this.sessionKnown = status !== 'unknown';
        this.signedIn = status === 'authenticated';
      });
  }

  get canSend(): boolean {
    return !this.sending && this.description.trim().length > 0;
  }

  addFiles(input: HTMLInputElement): void {
    this.error = null;
    for (const file of Array.from(input.files ?? [])) {
      if (this.files.length >= MAX_TICKET_ATTACHMENTS) {
        this.error = `Puedes adjuntar ${MAX_TICKET_ATTACHMENTS} archivos como mucho.`;
        break;
      }
      const type = ticketMimeOf(file);
      if (!type) {
        this.error = 'Formato no admitido. Usa una imagen o un PDF, Word, TXT o CSV.';
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        this.error = `${file.name} pesa ${megas(file.size)}. El máximo es 10 MB.`;
        continue;
      }
      this.files = [...this.files, { file, type }];
    }
    // Para poder volver a elegir el mismo archivo después de quitarlo.
    input.value = '';
  }

  removeFile(item: Pending): void {
    this.files = this.files.filter(f => f !== item);
  }

  size(item: Pending): string {
    return megas(item.file.size);
  }

  /**
   * Crea el ticket, sube los adjuntos y pide los correos. Por ese orden: así
   * la copia que le llega a soporte ya lleva los archivos.
   */
  async send(): Promise<void> {
    if (!this.canSend) {
      return;
    }
    this.sending = true;
    this.error = null;
    this.failedFiles = [];
    try {
      const withFiles = this.files.length > 0;
      const id = await this.support.createTicket({
        subject: this.subject,
        description: this.description,
        deferNotice: withFiles,
      });
      for (const [i, item] of this.files.entries()) {
        this.progress = `Subiendo ${i + 1} de ${this.files.length}…`;
        try {
          await this.support.uploadAttachment(id, item.file, item.type);
        } catch {
          this.failedFiles.push(item.file.name);
        }
      }
      if (withFiles) {
        // Si esto falla el ticket ya existe: el backend manda los correos de
        // los tickets que se quedan sin avisar. No es motivo para repetirlo.
        await this.support.notify(id).catch(() => undefined);
      }
      this.sent = true;
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.networkError
        ? 'Sin conexión. Comprueba tu red e inténtalo de nuevo.'
        : 'No se pudo enviar. Inténtalo de nuevo.';
    } finally {
      this.sending = false;
      this.progress = null;
    }
  }

  async copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.email);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      // Sin portapapeles el correo sigue a la vista para copiarlo a mano.
    }
  }

  goBack(): void {
    this.location.back();
  }
}

function megas(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
