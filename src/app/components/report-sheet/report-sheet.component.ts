import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../core/api-error';
import { DialogService } from '../../core/dialog.service';
import { ReportRepository } from '../../repositories/report.repository';
import { REPORT_REASONS, ReportReason } from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';

/** Tope de la descripción: el mismo que `GipsiInputLimits.reportDescription`. */
const DESCRIPTION_MAX = 1000;

/**
 * Hoja para que el cliente reporte un negocio. Port de `ReportBusinessSheet`.
 *
 * En la app el detalle se escribe en una hoja aparte porque el teclado del
 * móvil tapaba el campo; aquí no hay ese problema, así que va en la misma hoja
 * y el reporte sale con un clic menos.
 *
 * Quien la monta decide cuándo se ve; la hoja solo avisa con `closed` y con
 * `sent` (ya enviado, para que la ficha dé las gracias con su aviso).
 */
@Component({
  selector: 'app-report-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './report-sheet.component.html',
  styleUrl: './report-sheet.component.css',
})
export class ReportSheetComponent implements AfterViewInit, OnDestroy {
  private readonly reports = inject(ReportRepository);
  private readonly dialog = inject(DialogService);

  @Input({ required: true }) businessId!: number;
  @Input() businessName = '';

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<void>();

  @ViewChild('sheet') sheet?: ElementRef<HTMLElement>;

  readonly reasons = REPORT_REASONS;
  readonly descriptionMax = DESCRIPTION_MAX;

  reason: ReportReason | null = null;
  description = '';
  busy = false;
  error: string | null = null;

  /** Dónde estaba el foco al abrir, para devolverlo al cerrar. */
  private readonly previousFocus =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  ngAfterViewInit(): void {
    // El foco entra en la hoja: con él fuera, Escape y el tabulador seguían
    // moviéndose por la ficha de detrás.
    this.sheet?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }

  async submit(): Promise<void> {
    if (!this.reason || this.busy) {
      return;
    }
    this.busy = true;
    this.error = null;
    const text = this.description.trim();
    try {
      await this.reports.create({
        reportedId: this.businessId,
        targetType: 'BUSINESS',
        reason: this.reason,
        description: text.length > 0 ? text : undefined,
      });
      this.sent.emit();
    } catch (raw) {
      // El mensaje del servidor ya dice qué falla (p. ej. que ya lo reportaste).
      this.error = ApiError.from(raw).message || 'No se ha podido enviar el reporte. Inténtalo de nuevo.';
    } finally {
      this.busy = false;
    }
  }

  /**
   * Cierra, preguntando antes solo si hay algo escrito: perder un motivo
   * marcado cuesta un clic, perder un párrafo cuesta volver a escribirlo.
   */
  async close(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (this.description.trim().length > 0) {
      const ok = await this.dialog.confirm({
        title: '¿Descartar el reporte?',
        message: 'Se perderá lo que has escrito.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir escribiendo',
        destructive: true,
      });
      if (!ok) {
        this.sheet?.nativeElement.focus();
        return;
      }
    }
    this.closed.emit();
  }
}
