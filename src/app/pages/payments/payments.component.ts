import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { PaymentRepository } from '../../repositories/payment.repository';
import {
  PaymentMethodResponse,
  PaymentResponse,
  cardLabel,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AddCardSheetComponent } from '../../components/add-card-sheet/add-card-sheet.component';
import { GroupedSectionComponent } from '../../components/grouped-list/grouped-section.component';
import { GroupedRowComponent } from '../../components/grouped-list/grouped-row.component';
import { euros } from '../../shared/dates';

/**
 * Tus tarjetas y tus cobros. Port de `PaymentsScreen`.
 *
 * **Sin Stripe configurado en el backend la pantalla no se pinta**: se explica
 * y se sale, en vez de enseñar una lista vacía o fallar. Es el mismo criterio
 * que usan las apps con Maps, Firebase y Resend.
 *
 * El número de tarjeta nunca pasa por Bipsy: el formulario es un Element de
 * Stripe, servido por Stripe dentro de un iframe, y el backend solo ve el id
 * del método de pago resultante.
 */
@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, ButtonComponent, AddCardSheetComponent, GroupedSectionComponent, GroupedRowComponent],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css',
})
export class PaymentsComponent implements OnInit {
  private readonly payments = inject(PaymentRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;

  enabled = false;
  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  methods: PaymentMethodResponse[] = [];
  history: PaymentResponse[] = [];

  addOpen = false;
  busyId: number | null = null;
  error: string | null = null;

  /** La lee la plantilla para pasarsela a la hoja. */
  publishableKey: string | null = null;

  ngOnInit(): void {
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (this.isAuthenticated) {
        void this.load();
      } else {
        this.isLoading = false;
      }
    });
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      const config = await this.payments.config();
      this.enabled = config.enabled;
      this.publishableKey = config.publishableKey ?? null;
      if (!this.enabled) {
        return;
      }
      const [methods, history] = await Promise.allSettled([
        this.payments.methods(),
        this.payments.history(),
      ]);
      this.methods = methods.status === 'fulfilled' ? methods.value : [];
      this.history = history.status === 'fulfilled' ? history.value : [];
    } catch (raw) {
      this.loadError = ApiError.from(raw);
    } finally {
      this.isLoading = false;
    }
  }

  // ----- VISTA --------------------

  label(method: PaymentMethodResponse): string {
    return cardLabel(method);
  }

  expiry(method: PaymentMethodResponse): string | null {
    if (!method.expMonth || !method.expYear) {
      return null;
    }
    return `Caduca ${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}`;
  }

  amount(payment: PaymentResponse): string {
    return euros(payment.amountCents / 100);
  }

  /** `createdAt` es un `Instant` en UTC: hay que pasarlo a hora local. */
  when(payment: PaymentResponse): string {
    return new Date(payment.createdAt).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  kindLabel(payment: PaymentResponse): string {
    switch (payment.kind) {
      case 'RESCHEDULE_FEE': return 'Cambio de cita';
      case 'NO_SHOW_FEE': return 'No acudiste';
      default: return 'Cancelación';
    }
  }

  statusTone(payment: PaymentResponse): string {
    switch (payment.status) {
      case 'SUCCEEDED': return 'success';
      case 'FAILED': return 'danger';
      case 'REFUNDED': return 'mint';
      default: return 'warn';
    }
  }

  statusLabel(payment: PaymentResponse): string {
    switch (payment.status) {
      case 'SUCCEEDED': return 'Cobrado';
      case 'FAILED': return 'Rechazado';
      case 'REFUNDED': return 'Devuelto';
      case 'REQUIRES_ACTION': return 'Pago pendiente';
      default: return 'Pendiente';
    }
  }

  // ----- AÑADIR TARJETA --------------------
  //
  // La hoja es un componente aparte: el flujo de reserva la necesita igual, y
  // dos copias del baile de SetupIntent + confirmSetup se separan a la primera
  // corrección que se haga solo en una.

  async openAdd(): Promise<void> {
    if (!this.publishableKey) {
      return;
    }
    this.error = null;
    this.addOpen = true;
    // Se pinta primero y se prepara después: `open()` necesita que su hueco
    // exista para montar el formulario de Stripe.
    setTimeout(async () => {
      const ok = await this.cardSheet?.open();
      if (!ok) {
        this.addOpen = false;
        this.error = this.cardSheet?.error ?? 'No hemos podido abrir la pasarela de pago.';
      }
    });
  }

  onCardSaved(method: PaymentMethodResponse): void {
    this.methods = [...this.methods.filter(m => m.id !== method.id), method];
    this.addOpen = false;
  }

  closeAdd(): void {
    this.addOpen = false;
  }

  // ----- ACCIONES SOBRE UNA TARJETA --------------------

  async setDefault(method: PaymentMethodResponse): Promise<void> {
    if (method.isDefault || this.busyId !== null) {
      return;
    }
    this.busyId = method.id;
    try {
      await this.payments.setDefault(method.id);
      this.methods = this.methods.map(m => ({ ...m, isDefault: m.id === method.id }));
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busyId = null;
    }
  }

  async remove(method: PaymentMethodResponse): Promise<void> {
    if (this.busyId !== null) {
      return;
    }
    if (!confirm(`¿Quitamos la tarjeta ${this.label(method)}?`)) {
      return;
    }
    this.busyId = method.id;
    try {
      await this.payments.deleteMethod(method.id);
      this.methods = this.methods.filter(m => m.id !== method.id);
    } catch (raw) {
      const error = ApiError.from(raw);
      // El servidor no la deja quitar mientras una cita pueda acabar en cargo:
      // es la garantía que el negocio pidió para dejar reservar.
      this.error = error.isConflict
        ? 'No puedes quitarla mientras tengas una cita que pueda generar un cargo.'
        : error.message;
    } finally {
      this.busyId = null;
    }
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/pagos' } });
  }
}
