import { ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { PaymentRepository } from '../../repositories/payment.repository';
import { DialogService } from '../../core/dialog.service';
import { PaymentMethodResponse, cardLabel } from '../../models/bipsy.models';
import {
  PaymentRecord,
  cardExpiry,
  cardIsExpired,
  paymentKindLabel,
  paymentStatusLabel,
} from '../../models/payments-extras.models';
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
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly payments = inject(PaymentRepository);
  private readonly dialog = inject(DialogService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(AddCardSheetComponent) cardSheet?: AddCardSheetComponent;

  enabled = false;
  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  methods: PaymentMethodResponse[] = [];
  history: PaymentRecord[] = [];

  addOpen = false;
  busyId: number | null = null;
  error: string | null = null;

  /** La lee la plantilla para pasarsela a la hoja. */
  publishableKey: string | null = null;

  ngOnInit(): void {
    // Cortada al salir: la sesión no completa nunca, y cada visita dejaba
    // viva una suscripción que volvía a cargar los pagos al iniciar sesión.
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
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

  expired(method: PaymentMethodResponse): boolean {
    return cardIsExpired(method);
  }

  /** «Caduca 04/27», o «Caducada · 04/27»: una caducada no sirve para cobrar. */
  expiry(method: PaymentMethodResponse): string | null {
    const exp = cardExpiry(method);
    if (!exp) {
      return null;
    }
    return cardIsExpired(method) ? `Caducada · ${exp}` : `Caduca ${exp}`;
  }

  amount(payment: PaymentRecord): string {
    return euros(payment.amountCents / 100);
  }

  /**
   * Fecha y, si lo hay, el motivo del fallo. El estado va en la etiqueta de la
   * derecha y solo cuando NO es el normal: «Cobrado» en cada fila es ruido —el
   * importe ya lo dice—; «No cobrado» o «Pendiente de tu banco» hay que
   * leerlos. `createdAt` es un `Instant` en UTC: a hora local.
   */
  detail(payment: PaymentRecord): string {
    const d = new Date(payment.createdAt);
    const parts = [
      d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
      d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    ];
    if (payment.failureReason?.trim()) parts.push(payment.failureReason.trim());
    return parts.join(' · ');
  }

  kindLabel(payment: PaymentRecord): string {
    return payment.description?.trim() || paymentKindLabel(payment.kind);
  }

  statusTone(payment: PaymentRecord): string {
    return paymentStatusLabel(payment.status).tone;
  }

  statusLabel(payment: PaymentRecord): string {
    return paymentStatusLabel(payment.status).label;
  }

  /** Un cobro fallido no se ha llevado dinero: pintarlo igual haría pensar que sí. */
  failed(payment: PaymentRecord): boolean {
    return payment.status === 'FAILED';
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
      // `eventCoalescing` (app.config) deja la detección de cambios del clic
      // para el siguiente fotograma, y este setTimeout llega antes: el `@if`
      // aún no había pintado la hoja, `cardSheet` era undefined y salía «No
      // hemos podido abrir la pasarela de pago». Se pinta aquí, a la fuerza.
      this.cdr.detectChanges();
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
    const ok = await this.dialog.confirm({
      title: '¿Quitar la tarjeta?',
      message: `${this.label(method)} dejará de estar guardada en tu cuenta.`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!ok) {
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
