import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { GuestBookingRepository } from '../../repositories/guest-booking.repository';
import { GuestBookingResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { euros, longDate } from '../../shared/dates';

/**
 * La cita de quien ha reservado SIN cuenta, por el token de su enlace.
 *
 * Es el destino del correo y lo único que esta persona tiene: no hay «Mis
 * citas» donde buscarla, ni sesión que recuperar. Por eso la página se basta
 * sola —negocio, servicio, día, hora, precio y dirección vienen en la misma
 * respuesta— y por eso el enlace no caduca mientras la cita esté viva.
 *
 * Esto lo servía el backend como HTML escrito a mano en Java. Se trajo aquí para
 * que se parezca al resto del sitio, y de paso para poder limitar la ruta por
 * IP: con HTML, el 429 del limitador le habría soltado un volcado JSON en el
 * navegador.
 *
 * ⚠️ Cancelar es un POST, no un enlace. Gmail y Outlook **pre-cargan** los
 * enlaces de un correo para la vista previa, así que con un GET la cita se
 * cancelaría sola con solo abrirlo.
 */
@Component({
  selector: 'app-guest-booking',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './guest-booking.component.html',
  styleUrl: './guest-booking.component.css',
})
export class GuestBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly guest = inject(GuestBookingRepository);

  booking?: GuestBookingResponse;
  loading = true;
  busy = false;
  error: string | null = null;

  /** El enlace no vale: ni se dice si existió alguna vez. */
  invalidLink = false;

  /** Acaba de cancelarla en esta pantalla. Cambia lo que se le cuenta. */
  justCanceled = false;

  private token = '';

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.invalidLink = true;
      this.loading = false;
      return;
    }
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.booking = await this.guest.byToken(this.token);
    } catch (raw) {
      const error = ApiError.from(raw);
      // 404 es «este enlace no vale», y se dice igual tanto si el token no
      // existió nunca como si la cita se borró: distinguirlo convertiría la
      // página en un oráculo con el que ir probando tokens.
      this.invalidLink = error.isNotFound;
      this.error = this.invalidLink ? null : error.message;
    } finally {
      this.loading = false;
    }
  }

  /** Dice que sí va. Es un acuse: su cita vale igual sin esto. */
  async confirm(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = null;
    try {
      this.booking = await this.guest.confirm(this.token);
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Avisa de que no puede ir.
   *
   * Se confirma antes de hacerlo: el hueco se pierde y, si el negocio cobra por
   * cancelar tarde, puede haber un cargo. Las dos cosas se dicen en la pregunta,
   * no después.
   */
  async cancel(): Promise<void> {
    if (this.busy || !this.booking) return;

    const aviso = this.lateFeeWarning
      ? `¿Seguro que quieres cancelar? ${this.lateFeeWarning}`
      : '¿Avisar de que no puedes ir? El hueco quedará libre.';
    if (!confirm(aviso)) return;

    this.busy = true;
    this.error = null;
    try {
      this.booking = await this.guest.cancel(this.token);
      this.justCanceled = true;
    } catch (raw) {
      this.error = ApiError.from(raw).message;
    } finally {
      this.busy = false;
    }
  }

  // ----- VISTA --------------------

  get canceled(): boolean {
    return this.booking?.status === 'CANCELED';
  }

  get pending(): boolean {
    return this.booking?.status === 'PENDING';
  }

  /** Lo que se le cobró al cancelar, si se le cobró algo. */
  get feeCharged(): string | null {
    const cents = this.booking?.feeChargedCents ?? 0;
    return cents > 0 ? euros(cents / 100) : null;
  }

  /**
   * El aviso de que cancelar ahora puede costar dinero.
   *
   * Sale de la política que viaja con la cita, que es la que aceptó al reservar,
   * y no de la configuración de hoy del negocio: lo que se le puede cobrar es lo
   * que se le anunció.
   */
  get lateFeeWarning(): string | null {
    return this.booking?.policyText ?? null;
  }

  get dayLabel(): string {
    return this.booking ? longDate(new Date(this.booking.startDateTime)) : '';
  }

  get timeLabel(): string {
    // La hora viene en ISO local sin zona: se corta en vez de pasarla por Date,
    // que la interpretaría en la zona del navegador y la movería.
    return this.booking?.startDateTime.slice(11, 16) ?? '';
  }

  get priceLabel(): string {
    return this.booking ? euros(this.booking.priceCents / 100) : '';
  }
}
