import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { GuestBookingRepository } from '../../repositories/guest-booking.repository';
import { GuestRequestResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { euros, longDate } from '../../shared/dates';
import { businessPath } from '../../shared/slug';

/**
 * Confirmar una cita pedida sin cuenta. Es el destino del enlace del correo.
 *
 * Esta página es lo que hace que el correo sirva de verificación: si no llega,
 * nadie confirma, y la cita no llega a existir. Por eso aquí **no hay cita
 * todavía** — hay una solicitud — y por eso el botón principal dice «Confirmar
 * mi cita» y no «Ver mi cita».
 *
 * ⚠️ **El hueco no está reservado mientras esto espera.** Es lo que evita que un
 * correo mal escrito bloquee la agenda de un negocio, y tiene un precio: otra
 * persona puede haber cogido esa hora. Esta pantalla lo comprueba al cargar y lo
 * dice antes de ofrecer el botón, en vez de dejar pulsar para nada.
 */
@Component({
  selector: 'app-confirm-booking',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './confirm-booking.component.html',
  styleUrl: './confirm-booking.component.css',
})
export class ConfirmBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly guest = inject(GuestBookingRepository);

  request?: GuestRequestResponse;
  loading = true;
  busy = false;
  error: string | null = null;

  /** El enlace no vale: no existió, o ya se usó, o venció el plazo. */
  invalidLink = false;

  /**
   * El hueco ya no está libre.
   *
   * Se separa del resto de errores porque la salida es distinta: aquí no hay
   * nada que reintentar, hay que elegir otra hora.
   */
  slotGone = false;

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
      this.request = await this.guest.requestByToken(this.token);
    } catch (raw) {
      this.classify(raw);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Confirma, y con eso nace la cita.
   *
   * Al terminar lleva a la página de la cita, que es la que ya tiene todo lo que
   * puede hacer desde ahora: verla y avisar si no puede ir.
   */
  async confirm(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = null;
    try {
      const booking = await this.guest.confirmRequest(this.token);
      // El token de la CITA, que no es el de la solicitud: ésta ya no existe.
      await this.router.navigate(['/cita', booking.token], {
        state: { justConfirmed: true },
      });
    } catch (raw) {
      this.classify(raw);
    } finally {
      this.busy = false;
    }
  }

  /** Volver a pedir la cita, cuando el hueco se ha perdido o el enlace venció. */
  bookAgain(): void {
    if (!this.request) {
      this.router.navigate(['/']);
      return;
    }
    this.router.navigate(
      businessPath({ id: this.request.businessId, name: this.request.businessName }),
    );
  }

  /**
   * Traduce el fallo a una de las tres salidas que tiene esta pantalla.
   *
   * Son tres y no una porque lo que el cliente puede hacer es distinto en cada
   * caso: volver a pedir la cita, elegir otra hora, o nada.
   */
  private classify(raw: unknown): void {
    const error = ApiError.from(raw);
    if (error.isNotFound) {
      this.invalidLink = true;
      return;
    }
    // «Ese horario ya esta ocupado» y sus hermanos llegan como 400 de regla de
    // negocio; el enlace caducado, como 409.
    const ocupado = /ocupad|disponible|horario/i.test(error.message ?? '');
    if (ocupado) {
      this.slotGone = true;
      return;
    }
    if (error.isConflict) {
      this.invalidLink = true;
      return;
    }
    this.error = error.message;
  }

  // ----- VISTA --------------------

  get dayLabel(): string {
    return this.request ? longDate(new Date(this.request.startDateTime)) : '';
  }

  get timeLabel(): string {
    // Hora local sin zona: se corta en vez de pasarla por Date, que la
    // interpretaría en la zona del navegador y la movería.
    return this.request?.startDateTime.slice(11, 16) ?? '';
  }

  get priceLabel(): string {
    return this.request ? euros(this.request.priceCents / 100) : '';
  }
}
