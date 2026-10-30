import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from '../../../core/api-error';
import { SessionService } from '../../../core/session.service';
import { AuthRepository } from '../../../repositories/auth.repository';
import { ButtonComponent } from '../../../components/button/button.component';

/**
 * Espera de verificación del correo. Port de `EmailPendingScreen`.
 *
 * `SessionService` trae aquí a quien tiene sesión con el correo sin verificar
 * y le saca en cuanto `/me` dice que ya lo está. Esta pantalla no navega por
 * su cuenta al comprobarlo: si lo hiciera, habría dos sitios decidiendo a
 * dónde se va y acabarían discrepando.
 */
@Component({
  selector: 'app-email-pending',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="flow anim-fade-up">
      <div class="flow__inner">
        <span class="material-symbols-rounded pending__icon" aria-hidden="true">mark_email_unread</span>
        <h1 class="flow__title">Verifica tu email</h1>
        <p class="flow__subtitle">Hemos enviado un enlace de verificación a:</p>
        <p class="pending__email">{{ email }}</p>
        <p class="flow__subtitle">
          Ábrelo y pulsa el botón para activar tu cuenta. Después vuelve aquí y pulsa «Ya lo verifiqué».
        </p>

        @if (error) {
          <p class="flow__error" role="alert">
            <span class="material-symbols-rounded fill" aria-hidden="true">error</span>{{ error }}
          </p>
        }
        @if (resent) {
          <p class="flow__notice" role="status">
            <span class="material-symbols-rounded fill" aria-hidden="true">check_circle</span>Correo reenviado. Revisa tu bandeja de entrada.
          </p>
        }

        <div class="flow__actions">
          <app-button variant="primary" size="large" [fullWidth]="true" [loading]="checking" (onClick)="check()">
            Ya lo verifiqué
          </app-button>
          @if (!resent) {
            <app-button variant="secondary" [fullWidth]="true" [loading]="resending" (onClick)="resend()">
              Reenviar correo
            </app-button>
          }
          <app-button variant="text" [fullWidth]="true" [disabled]="checking || resending" (onClick)="backToRegister()">
            Volver al registro
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pending__icon { display: block; margin: 8px auto 0; font-size: 56px; color: var(--clr-text-3); }
    .pending__email {
      margin-top: 6px;
      font-size: 1.0625rem;
      font-weight: 700;
      text-align: center;
      color: var(--clr-text);
      overflow-wrap: anywhere;
    }
  `],
})
export class EmailPendingComponent {
  private readonly session = inject(SessionService);
  private readonly auth = inject(AuthRepository);
  private readonly router = inject(Router);

  checking = false;
  resending = false;
  resent = false;
  error: string | null = null;

  get email(): string {
    return this.session.currentUser?.email ?? '';
  }

  async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    this.error = null;
    try {
      const stillPending = await this.session.recheckEmail();
      if (stillPending) {
        this.error = 'Todavía no nos consta. Abre el enlace del correo y vuelve a probar.';
      }
    } catch (raw) {
      this.error = ApiError.from(raw).networkError
        ? 'Sin conexión. Comprueba tu red.'
        : 'No hemos podido comprobarlo. Inténtalo de nuevo.';
    } finally {
      this.checking = false;
    }
  }

  async resend(): Promise<void> {
    if (this.resending || this.resent) return;
    this.resending = true;
    this.error = null;
    try {
      await this.auth.resendVerification();
      this.resent = true;
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.networkError
        ? 'Sin conexión. Comprueba tu red.'
        : error.isTooManyRequests ? error.message : 'No hemos podido reenviarlo. Inténtalo de nuevo.';
    } finally {
      this.resending = false;
    }
  }

  /** Como la app: cierra la sesión y vuelve a empezar el alta. */
  async backToRegister(): Promise<void> {
    await this.session.logout();
    this.router.navigate(['/crear-cuenta'], { replaceUrl: true });
  }
}
