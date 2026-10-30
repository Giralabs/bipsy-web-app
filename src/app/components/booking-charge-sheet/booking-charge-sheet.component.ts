import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiError } from '../../core/api-error';
import { PaymentRepository } from '../../repositories/payment.repository';
import { CancellationFee, PaymentMethodResponse, cardLabel } from '../../models/bipsy.models';
import { PaymentRecord, cardExpiry, cents, defaultCard } from '../../models/payments-extras.models';
import { ButtonComponent } from '../button/button.component';

type Phase = 'review' | 'processing' | 'result';

/**
 * `done` es true si la acción llegó a ejecutarse (aunque el cargo fallara: la
 * cita queda igual de cancelada y quien llama tiene que refrescar).
 * `openPayments` pide abrir Pagos **después** de que quien llama se ocupe de
 * lo suyo; navegar desde aquí dejaría su pantalla a medio actualizar.
 */
export interface BookingChargeOutcome {
  done: boolean;
  openPayments: boolean;
}

/**
 * Cobro de una tarifa, de principio a fin y sin mentir. Port de
 * `showBookingChargeSheet` (booking_charge_sheet.dart).
 *
 * Antes esto era un diálogo de texto y se daba el cobro por bueno **antes de
 * saber si el banco lo había aceptado**. Aquí se ve el importe, la tarjeta con
 * la que se paga y **cómo acabó de verdad**: después de la acción se pregunta
 * al servidor por el cargo que se acaba de crear (`GET /payments/booking/{id}`)
 * —se crea en la misma transacción que la cancelación—.
 */
@Component({
  selector: 'app-booking-charge-sheet',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './booking-charge-sheet.component.html',
  styleUrl: './booking-charge-sheet.component.css',
})
export class BookingChargeSheetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly payments = inject(PaymentRepository);

  @Input({ required: true }) title = '';
  @Input({ required: true }) confirmLabel = '';
  @Input({ required: true }) concept = '';
  @Input({ required: true }) fee!: CancellationFee;
  @Input({ required: true }) bookingId!: number;
  /** La acción que genera el cargo: cancelar o cambiar de hora. */
  @Input({ required: true }) onConfirm!: () => Promise<unknown>;
  /**
   * Qué hace esa acción con la cita. Solo cambia lo que se le cuenta: tras
   * cambiar la hora, «la cita queda cancelada» asustaría a quien la acaba de
   * mover (la app lo dice así, y es un fallo suyo que aquí no se copia).
   */
  @Input() action: 'cancel' | 'reschedule' = 'cancel';

  @Output() closed = new EventEmitter<BookingChargeOutcome>();

  @ViewChild('box') private box?: ElementRef<HTMLElement>;
  @ViewChild('heading') private heading?: ElementRef<HTMLElement>;

  phase: Phase = 'review';
  methods: PaymentMethodResponse[] | null = null;
  methodsLoading = true;

  /** Error de la acción en sí, no del cobro: la cita no se ha tocado. */
  actionError: string | null = null;

  /** El cargo como quedó en el servidor. Null si no llegó a crearse. */
  payment: PaymentRecord | null = null;

  private returnFocus: HTMLElement | null = null;

  async ngOnInit(): Promise<void> {
    this.returnFocus = document.activeElement as HTMLElement | null;
    try {
      this.methods = await this.payments.methods();
    } catch {
      this.methods = [];
    } finally {
      this.methodsLoading = false;
    }
  }

  ngAfterViewInit(): void {
    this.focusHeading();
  }

  ngOnDestroy(): void {
    this.returnFocus?.focus?.();
  }

  private focusHeading(): void {
    setTimeout(() => this.heading?.nativeElement.focus());
  }

  // ----- VISTA --------------------

  get feeAmount(): string {
    return cents(this.fee.amountCents);
  }

  get card(): PaymentMethodResponse | null {
    return this.methods ? defaultCard(this.methods) : null;
  }

  get hasCard(): boolean {
    return !!this.card;
  }

  cardText(method: PaymentMethodResponse): string {
    return cardLabel(method);
  }

  cardExp(method: PaymentMethodResponse): string {
    return cardExpiry(method);
  }

  get reviewNote(): string {
    // Sin tarjeta el cobro no puede salir, y hay que decirlo antes: prometer un
    // cargo que no va a ocurrir y dejar una deuda callada es peor que no cobrar.
    return this.hasCard
      ? `El cargo se hace ahora mismo. Quedan menos de ${this.fee.windowHours} h para la cita, así que se aplica el ${this.fee.feePercent} % del servicio.`
      : `Sin tarjeta guardada no podemos hacer el cargo. La cita se ${this.action === 'cancel' ? 'cancelará' : 'cambiará'} igual y el ${this.fee.feePercent} % (${this.feeAmount}) quedará pendiente con el negocio.`;
  }

  /** «La cita queda cancelada» o «La cita queda cambiada», según la acción. */
  private get actionDone(): string {
    return this.action === 'cancel' ? 'La cita queda cancelada' : 'La cita queda cambiada';
  }

  get payButtonLabel(): string {
    return this.hasCard ? `${this.confirmLabel} · ${this.feeAmount}` : this.title;
  }

  /**
   * La cita venía PAGADA: no se cobra nada nuevo, se descuenta la tarifa de lo
   * pagado y se devuelve el resto. Va primero porque «devuelto en parte» no es
   * ni cobrado ni pendiente ni fallido, y caía en «No se ha podido cobrar».
   */
  get settled(): boolean {
    return this.payment?.status === 'PARTIALLY_REFUNDED' || this.payment?.status === 'REFUNDED';
  }

  get charged(): boolean {
    return this.payment?.status === 'SUCCEEDED';
  }

  get pending(): boolean {
    if (this.settled) return false;
    const s = this.payment?.status;
    return !this.payment || s === 'PENDING' || s === 'AUTHORIZED' || s === 'REQUIRES_ACTION';
  }

  get resultTone(): 'ok' | 'warn' | 'bad' {
    if (this.charged || this.settled) return 'ok';
    return this.pending ? 'warn' : 'bad';
  }

  get resultTitle(): string {
    if (this.settled) return 'Cita cancelada';
    if (this.charged) return 'Pago realizado';
    return this.pending ? 'Pago pendiente' : 'No se ha podido cobrar';
  }

  get resultBody(): string {
    const p = this.payment;
    if (this.settled && p) {
      // Los dos números, y lo que vuelve primero: es lo que quiere saber.
      const refunded = p.refundedCents ?? 0;
      return refunded > 0
        ? `Se te devuelven ${cents(refunded)}. El negocio se queda ${cents(p.amountCents - refunded)} por cancelar fuera de plazo.`
        : 'Se te devuelve todo lo que habías pagado.';
    }
    if (this.charged) return `${this.actionDone} y el cargo ya está hecho.`;
    if (this.pending) return `${this.actionDone}. El cobro sigue su curso; lo verás actualizado en Pagos.`;
    return `${this.actionDone} igualmente, pero el cargo no ha salido adelante.`;
  }

  get receiptAmount(): string {
    return cents(this.payment?.amountCents ?? this.fee.amountCents);
  }

  get receiptConcept(): string {
    return this.payment?.description || this.concept;
  }

  /** `createdAt` es un `Instant` en UTC: se pinta en la hora de quien mira. */
  get receiptDate(): string | null {
    if (!this.payment) return null;
    const d = new Date(this.payment.createdAt);
    const day = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const hour = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${day} · ${hour}`;
  }

  // ----- ACCIONES --------------------

  async pay(): Promise<void> {
    if (this.phase !== 'review') return;
    this.phase = 'processing';
    this.actionError = null;

    try {
      await this.onConfirm();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.phase = 'review';
      // Al cambiar de hora, el 409 es casi siempre el hueco nuevo, que alguien
      // ha cogido entre tanto; al cancelar, que la cita ya no lo admite.
      this.actionError = !error.isConflict
        ? error.message
        : this.action === 'reschedule'
          ? 'Ese hueco acaba de ocuparse. Vuelve y elige otro.'
          : 'Esta cita ya no se puede cambiar.';
      return;
    }

    // Si la consulta falla, recibo sin detalle en vez de dar por bueno un
    // cobro que no se ha podido confirmar.
    try {
      this.payment = await this.payments.forBooking(this.bookingId);
    } catch {
      this.payment = null;
    }
    this.phase = 'result';
    this.focusHeading();
  }

  finish(openPayments: boolean): void {
    this.closed.emit({ done: true, openPayments });
  }

  /**
   * Volver, el velo o Escape. Mientras se cobra no se puede cerrar —saldría
   * sin saber si le han cobrado—, y desde el recibo se sale con el resultado:
   * la cita ya está cancelada, así que irse no es «no ha pasado nada».
   */
  dismiss(): void {
    if (this.phase === 'processing') return;
    this.closed.emit({ done: this.phase === 'result', openPayments: false });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss();
      return;
    }
    if (event.key === 'Tab' && this.box) {
      const items = Array.from(
        this.box.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
