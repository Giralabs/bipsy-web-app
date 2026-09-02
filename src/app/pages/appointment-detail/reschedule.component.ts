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
import { euros, isoDate, isoLocalDateTime, longDate, relativeDate, time } from '../../shared/dates';

/**
 * Cambiar el día o la hora de una cita. Port de `RescheduleScreen`.
 *
 * Repite la validación completa de disponibilidad —es una reserva nueva en
 * todo salvo en el id— y **se penaliza igual que cancelar**, calculando sobre
 * la hora original. Por eso la tarifa se enseña ANTES de elegir hueco: cambiar
 * de día dentro de la ventana cuesta lo mismo que echarse atrás.
 */
@Component({
  selector: 'app-reschedule',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
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

  days: Date[] = [];
  day?: Date;
  slots: AvailabilitySlot[] = [];
  slotsLoading = false;

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
    this.isLoading = false;

    const [business, fee] = await Promise.allSettled([
      this.catalog.business(this.booking.businessId),
      this.bookings.cancellationFee(this.booking.id),
    ]);
    if (business.status === 'fulfilled') {
      this.business = business.value;
      this.buildDays(this.business.availabilityHorizonDays ?? 30);
    } else {
      this.buildDays(30);
    }
    if (fee.status === 'fulfilled') {
      this.fee = fee.value;
    }
  }

  get willCharge(): boolean {
    return !!this.fee?.willCharge;
  }

  get feeAmount(): string {
    return euros((this.fee?.amountCents ?? 0) / 100);
  }

  get currentWhen(): string {
    if (!this.booking) {
      return '';
    }
    const start = new Date(this.booking.startDateTime);
    return `${longDate(start)} a las ${time(start)}`;
  }

  get availableSlots(): AvailabilitySlot[] {
    return this.slots.filter(s => s.available);
  }

  dayShort(day: Date): string {
    return relativeDate(day);
  }

  async chooseDay(day: Date): Promise<void> {
    if (!this.booking) {
      return;
    }
    this.day = day;
    this.slotsLoading = true;
    this.error = null;
    try {
      const res = await this.catalog.availability(
        this.booking.serviceId,
        isoDate(day),
        this.booking.workerId,
      );
      this.slots = res.slots ?? [];
    } catch (raw) {
      this.error = ApiError.from(raw).message;
      this.slots = [];
    } finally {
      this.slotsLoading = false;
    }
  }

  async confirm(slot: AvailabilitySlot): Promise<void> {
    if (!this.booking || !this.day || this.saving) {
      return;
    }
    const message = this.willCharge
      ? `Cambiar la cita ahora cuesta ${this.feeAmount} (${this.fee!.feePercent} % del servicio), ` +
        `porque quedan menos de ${this.fee!.windowHours} h. ¿Seguimos?`
      : `¿Movemos tu cita al ${longDate(this.day)} a las ${slot.start}?`;
    if (!confirm(message)) {
      return;
    }

    this.saving = true;
    this.error = null;
    try {
      this.booking = await this.bookings.reschedule(this.booking.id, {
        startDateTime: isoLocalDateTime(this.day, slot.start),
        workerId: this.booking.workerId,
      });
      this.done = true;
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.isConflict
        ? 'Ese hueco acaba de ocuparse. Elige otro.'
        : error.message;
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    this.location.back();
  }

  goToDetail(): void {
    this.router.navigate(['/appointments', this.booking!.id]);
  }

  private buildDays(horizon: number): void {
    const total = Math.min(horizon > 0 ? horizon : 30, 60);
    const today = new Date();
    this.days = Array.from({ length: total }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      day.setHours(0, 0, 0, 0);
      return day;
    });
  }
}
