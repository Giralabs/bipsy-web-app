import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { BookingRepository } from '../../repositories/booking.repository';
import { CatalogRepository } from '../../repositories/catalog.repository';
import {
  AvailabilitySlot,
  BookingResponse,
  BusinessResponse,
  CancellationFee,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { FlowHeaderComponent } from '../../components/booking-steps/flow-header.component';
import { MonthCalendarComponent } from '../../components/booking-steps/month-calendar.component';
import { SlotGridComponent } from '../../components/booking-steps/slot-grid.component';
import {
  BookingChargeOutcome,
  BookingChargeSheetComponent,
} from '../../components/booking-charge-sheet/booking-charge-sheet.component';
import {
  euros,
  isoDate,
  isoLocalDateTime,
  longDate,
  parseLocal,
  time,
} from '../../shared/dates';

type Step = 'date' | 'time' | 'confirm';

/**
 * Cambiar el día o la hora de una cita. Port de `RescheduleScreen`.
 *
 * Reutiliza el calendario y la rejilla de horas del flujo de reserva: la
 * disponibilidad se pinta exactamente igual que al reservar y no hay dos
 * versiones de la misma pantalla.
 *
 * Repite la validación completa —es una reserva nueva en todo salvo en el id—
 * y **se penaliza igual que cancelar**, calculando sobre la hora original. El
 * importe se enseña en el paso final, en el mismo sitio que el botón que lo
 * acepta: antes era un diálogo encima de la rejilla, y el aviso se leía como
 * una interrupción y no como lo que es, el precio del cambio.
 */
@Component({
  selector: 'app-reschedule',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    FlowHeaderComponent,
    MonthCalendarComponent,
    SlotGridComponent,
    BookingChargeSheetComponent,
  ],
  templateUrl: './reschedule.component.html',
  styleUrl: './reschedule.component.css',
})
export class RescheduleComponent implements OnInit {
  private readonly bookings = inject(BookingRepository);
  private readonly catalog = inject(CatalogRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  booking?: BookingResponse;
  business?: BusinessResponse;
  fee: CancellationFee | null = null;
  feeLoading = true;

  step: Step = 'date';
  firstDay = startOfToday();
  lastDay = startOfToday();
  horizonDays = 30;

  day?: Date;
  slots: AvailabilitySlot[] = [];
  slotsLoading = false;
  slotsError: string | null = null;
  startTime?: string;
  /** Libres en la hora elegida, por si la cita no tenía profesional. */
  private slotWorkerIds: number[] = [];

  isLoading = true;
  saving = false;
  loadError: ApiError | null = null;
  error: string | null = null;
  done = false;

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    try {
      this.booking = await this.bookings.byId(id);
    } catch (raw) {
      this.loadError = ApiError.from(raw);
      this.isLoading = false;
      return;
    }

    const [business, fee] = await Promise.allSettled([
      this.catalog.business(this.booking.businessId),
      this.bookings.cancellationFee(this.booking.id),
    ]);
    if (business.status === 'fulfilled') {
      this.business = business.value;
    }
    this.buildHorizon(this.business?.availabilityHorizonDays || 30);
    // Sin día elegido queda elegido hoy, como al reservar: un calendario con
    // hoy resaltado y el botón apagado decía dos cosas a la vez.
    this.day = new Date(this.firstDay);
    if (fee.status === 'fulfilled') {
      this.fee = fee.value;
    }
    this.feeLoading = false;
    this.isLoading = false;
  }

  // ----- CABECERA --------------------

  get stepTitle(): string {
    switch (this.step) {
      case 'date': return '¿Qué día?';
      case 'time': return '¿A qué hora?';
      default: return 'Confirma el cambio';
    }
  }

  get progress(): number {
    return (['date', 'time', 'confirm'].indexOf(this.step) + 1) / 3;
  }

  back(): void {
    this.error = null;
    if (this.step === 'confirm') {
      this.step = 'time';
    } else if (this.step === 'time') {
      this.step = 'date';
    } else {
      this.location.back();
    }
  }

  // ----- PASOS --------------------

  chooseDay(day: Date): void {
    if (this.day && day.getTime() === this.day.getTime()) {
      return;
    }
    this.day = day;
    this.startTime = undefined;
    this.slotWorkerIds = [];
  }

  toTime(): void {
    this.step = 'time';
    window.scrollTo({ top: 0 });
    void this.loadSlots();
  }

  async loadSlots(): Promise<void> {
    if (!this.booking || !this.day) {
      return;
    }
    // Como al reservar: si llega tarde la respuesta de un día que ya no es el
    // elegido, no debe pisar las horas del día bueno.
    const seq = ++this.slotsSeq;
    this.slotsLoading = true;
    this.slotsError = null;
    this.slots = [];
    try {
      const res = await this.catalog.availability(
        this.booking.serviceId,
        isoDate(this.day),
        this.booking.workerId,
      );
      if (seq !== this.slotsSeq) return;
      this.slots = res.slots ?? [];
    } catch (raw) {
      if (seq !== this.slotsSeq) return;
      this.slotsError = ApiError.from(raw).message;
      this.slots = [];
    } finally {
      if (seq === this.slotsSeq) this.slotsLoading = false;
    }
  }

  private slotsSeq = 0;

  chooseSlot(slot: AvailabilitySlot): void {
    this.startTime = slot.start;
    this.slotWorkerIds = slot.availableWorkerIds ?? [];
  }

  get hasFreeSlots(): boolean {
    return this.slots.some(s => s.available);
  }

  toConfirm(): void {
    if (this.startTime) {
      this.error = null;
      this.step = 'confirm';
      window.scrollTo({ top: 0 });
      void this.refreshFee();
    }
  }

  /**
   * El importe se vuelve a pedir al llegar al resumen: el de la carga puede ser
   * de antes de entrar en la ventana —elegir día y hora lleva su rato— y el
   * servidor cobra con la hora de AHORA. Si falla, se queda el que había.
   */
  private async refreshFee(): Promise<void> {
    if (!this.booking) return;
    this.feeLoading = true;
    try {
      this.fee = await this.bookings.cancellationFee(this.booking.id);
    } catch {
      // Se sigue con el de la carga.
    } finally {
      this.feeLoading = false;
    }
  }

  // ----- CONFIRMAR --------------------

  get willCharge(): boolean {
    return !!this.fee?.willCharge;
  }

  get feeAmount(): string {
    return euros((this.fee?.amountCents ?? 0) / 100);
  }

  get confirmLabel(): string {
    return this.willCharge ? `Cambiar y pagar ${this.feeAmount}` : 'Confirmar cambio';
  }

  /** "Viernes, 30 de octubre · 10:30". */
  get currentWhen(): string {
    if (!this.booking) {
      return '';
    }
    const start = parseLocal(this.booking.startDateTime);
    return `${longDate(start)} · ${time(start)}`;
  }

  get dayLabel(): string {
    return this.day ? longDate(this.day) : '';
  }

  get newWhen(): string {
    return this.day && this.startTime ? `${longDate(this.day)} · ${this.startTime}` : '';
  }

  /** La hoja de cobro abierta: cambiar dentro de la ventana cuesta dinero. */
  chargeSheetOpen = false;
  /**
   * El cambio pasó por la hoja de cobro: ella ya ha dicho cómo acabó el cargo
   * de verdad, y el resultado no debe repetir «se ha cobrado» a ciegas.
   */
  chargedViaSheet = false;

  /**
   * Sin cargo no hay segunda confirmación: un aviso extra que no avisa de nada
   * solo enseña a ignorarlos. Con cargo va por la hoja de cobro, como en la
   * app: enseña la tarjeta y cómo quedó el cargo, en vez de darlo por bueno
   * antes de saber si el banco lo ha aceptado.
   */
  confirmOrCharge(): void {
    if (this.saving || !this.day || !this.startTime) return;
    if (this.willCharge) {
      this.error = null;
      this.chargeSheetOpen = true;
      return;
    }
    void this.confirm();
  }

  readonly rescheduleForCharge = async (): Promise<void> => {
    this.booking = await this.bookings.reschedule(this.booking!.id, this.rescheduleRequest());
  };

  get chargeConcept(): string {
    return `Cambio de cita · ${this.booking?.serviceName ?? ''}`;
  }

  onChargeClosed(outcome: BookingChargeOutcome): void {
    this.chargeSheetOpen = false;
    if (!outcome.done) return;
    this.chargedViaSheet = true;
    this.done = true;
    window.scrollTo({ top: 0 });
    if (outcome.openPayments) {
      this.router.navigate(['/pagos']);
    }
  }

  private rescheduleRequest() {
    return {
      startDateTime: isoLocalDateTime(this.day!, this.startTime!),
      // Se mantiene el profesional de la cita. Si no tenía —y el servidor
      // exige uno—, el primero libre en el hueco nuevo, igual que al crear.
      workerId: this.booking!.workerId ?? this.slotWorkerIds[0],
    };
  }

  async confirm(): Promise<void> {
    if (!this.booking || !this.day || !this.startTime || this.saving) {
      return;
    }
    this.saving = true;
    this.error = null;
    try {
      this.booking = await this.bookings.reschedule(this.booking.id, this.rescheduleRequest());
      this.done = true;
      window.scrollTo({ top: 0 });
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isConflict) {
        this.error = 'Ese hueco acaba de ocuparse. Elige otro.';
      } else if (error.networkError) {
        this.error = 'Sin conexión. Comprueba tu red.';
      } else {
        this.error = error.message || 'No hemos podido cambiar la cita.';
      }
    } finally {
      this.saving = false;
    }
  }

  goToDetail(): void {
    this.router.navigate(['/citas', this.booking!.id]);
  }

  private buildHorizon(horizon: number): void {
    this.horizonDays = horizon > 0 ? horizon : 30;
    const last = new Date(this.firstDay);
    last.setDate(this.firstDay.getDate() + this.horizonDays - 1);
    this.lastDay = last;
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
