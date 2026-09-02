import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { WaitlistRepository } from '../../repositories/waitlist.repository';
import {
  WaitlistEntry,
  WaitlistOffer,
  isOfferOpen,
  offerTimeLeftMs,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';
import { longDate, time } from '../../shared/dates';

/**
 * Tus esperas y los avisos de hueco libre. Port de `WaitlistSummary`.
 *
 * Va **arriba del todo de "Próximas"** y no en una pestaña aparte: los avisos
 * caducan en horas, así que si hay que ir a buscarlos ya no sirven.
 */
@Component({
  selector: 'app-waitlist-summary',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './waitlist-summary.component.html',
  styleUrl: './waitlist-summary.component.css',
})
export class WaitlistSummaryComponent implements OnInit, OnDestroy {
  private readonly waitlist = inject(WaitlistRepository);
  private readonly router = inject(Router);

  entries: WaitlistEntry[] = [];
  offers: WaitlistOffer[] = [];
  busyId: number | null = null;
  error: string | null = null;

  /** Se refresca solo para que la cuenta atrás no se quede congelada. */
  private ticker?: ReturnType<typeof setInterval>;

  async ngOnInit(): Promise<void> {
    await this.load();
    this.ticker = setInterval(() => this.prune(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
    }
  }

  async load(): Promise<void> {
    // Ni las esperas ni los avisos pueden tumbar "Mis citas": es un añadido
    // sobre la lista, no la lista.
    const [entries, offers] = await Promise.allSettled([
      this.waitlist.mine(),
      this.waitlist.myOffers(),
    ]);
    this.entries = entries.status === 'fulfilled' ? entries.value : [];
    this.offers = offers.status === 'fulfilled' ? offers.value.filter(isOfferOpen) : [];
  }

  get hasSomething(): boolean {
    return this.offers.length > 0 || this.entries.length > 0;
  }

  /** Las esperas que ya tienen aviso no se repiten debajo. */
  get waitingEntries(): WaitlistEntry[] {
    const offered = new Set(this.offers.map(o => o.entryId));
    return this.entries.filter(e => e.status === 'WAITING' && !offered.has(e.id));
  }

  slotLabel(offer: WaitlistOffer): string {
    const start = new Date(offer.slotStart);
    return `${longDate(start)} a las ${time(start)}`;
  }

  rangeLabel(entry: WaitlistEntry): string {
    const from = new Date(entry.dateFrom);
    const to = new Date(entry.dateTo);
    return from.toDateString() === to.toDateString()
      ? longDate(from)
      : `${longDate(from)} — ${longDate(to)}`;
  }

  /** "Te quedan 2 h 10 min". Por debajo de un minuto ya no se ofrece. */
  timeLeft(offer: WaitlistOffer): string {
    const ms = offerTimeLeftMs(offer);
    if (ms <= 0) {
      return 'Caducado';
    }
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours} h ${minutes % 60} min`;
  }

  async accept(offer: WaitlistOffer): Promise<void> {
    if (this.busyId !== null) {
      return;
    }
    // Con política de cancelación hay que aceptarla: sin eso el servidor
    // responde 400 y el aviso sigue vivo, así que se pregunta aquí.
    if (offer.requiresPolicyConsent) {
      const text = offer.policyText ??
        'Este negocio cobra una tarifa si cancelas con poca antelación.';
      if (!confirm(`${text}\n\n¿Aceptas y te quedas el hueco?`)) {
        return;
      }
    }

    this.busyId = offer.id;
    this.error = null;
    try {
      const result = await this.waitlist.acceptOffer(offer.id, offer.requiresPolicyConsent);
      this.offers = this.offers.filter(o => o.id !== offer.id);
      if (result.bookingId) {
        this.router.navigate(['/appointments', result.bookingId]);
      }
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.isConflict
        ? 'Ese hueco se lo ha quedado otra persona. Sigues en la lista.'
        : error.message;
    } finally {
      this.busyId = null;
    }
  }

  async decline(offer: WaitlistOffer): Promise<void> {
    if (this.busyId !== null) {
      return;
    }
    if (!confirm('Rechazar cierra tu espera entera y pasa el turno al siguiente. ¿Seguimos?')) {
      return;
    }
    this.busyId = offer.id;
    try {
      await this.waitlist.declineOffer(offer.id);
      this.offers = this.offers.filter(o => o.id !== offer.id);
      this.entries = this.entries.filter(e => e.id !== offer.entryId);
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busyId = null;
    }
  }

  async leave(entry: WaitlistEntry): Promise<void> {
    if (this.busyId !== null) {
      return;
    }
    if (!confirm(`¿Salimos de la lista de espera de "${entry.serviceName}"?`)) {
      return;
    }
    this.busyId = entry.id;
    try {
      await this.waitlist.leave(entry.id);
      this.entries = this.entries.filter(e => e.id !== entry.id);
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busyId = null;
    }
  }

  /** Quita los avisos que han vencido mientras la pantalla estaba abierta. */
  private prune(): void {
    this.offers = this.offers.filter(isOfferOpen);
  }
}
