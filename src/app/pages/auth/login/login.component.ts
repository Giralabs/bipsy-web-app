import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api-error';
import { SessionService } from '../../../core/session.service';
import { GoogleAuthService, GoogleSignInCancelled } from '../../../core/google-auth.service';
import { ButtonComponent } from '../../../components/button/button.component';

/**
 * Pantalla de acceso. Port de `LoginScreen`.
 *
 * La marca arriba: esta es la puerta de casa y se agradece verla, pero el
 * trabajo de la pantalla son dos campos y un botón.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly google = inject(GoogleAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  username = '';
  password = '';
  showPassword = false;
  loading = false;
  googleLoading = false;
  error: string | null = null;
  notice: string | null = null;

  /** Cuenta nueva con Google: falta el teléfono antes de poder entrar. */
  needsPhone = false;
  phone = '';
  private googleIdToken: string | null = null;

  private returnTo = '/home';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    // Quien escribe su correo para registrarse y resulta que ya tiene cuenta
    // no debería tener que volver a escribirlo aquí.
    this.username = params['email'] ?? '';
    this.returnTo = params['returnTo'] ?? this.session.takeReturnTo() ?? '/home';
    if (params['changed']) {
      this.notice = 'Contraseña cambiada. Ya puedes entrar con ella.';
    }
  }

  get googleAvailable(): boolean {
    return this.google.isAvailable;
  }

  get busy(): boolean {
    return this.loading || this.googleLoading;
  }

  async submit(): Promise<void> {
    if (this.busy) {
      return;
    }
    if (!this.username.trim()) {
      this.error = 'Introduce tu correo';
      return;
    }
    if (!this.password) {
      this.error = 'Introduce tu contraseña';
      return;
    }

    this.loading = true;
    this.error = null;
    try {
      await this.session.login({ username: this.username.trim(), password: this.password });
      this.router.navigateByUrl(this.returnTo);
    } catch (raw) {
      this.error = messageFor(ApiError.from(raw));
    } finally {
      this.loading = false;
    }
  }

  // ----- GOOGLE --------------------

  async signInWithGoogle(): Promise<void> {
    if (this.busy) {
      return;
    }
    this.googleLoading = true;
    this.error = null;
    try {
      this.googleIdToken = await this.google.obtainIdToken();
      await this.exchangeGoogleToken();
    } catch (raw) {
      if (raw instanceof GoogleSignInCancelled) {
        return;
      }
      this.error = googleMessageFor(raw);
    } finally {
      this.googleLoading = false;
    }
  }

  /** Segundo intento, ya con el teléfono que pidió el servidor. */
  async submitPhone(): Promise<void> {
    if (this.phone.trim().length < 9) {
      this.error = 'Introduce tu teléfono';
      return;
    }
    this.googleLoading = true;
    this.error = null;
    try {
      await this.exchangeGoogleToken(this.phone.trim());
    } catch (raw) {
      this.error = googleMessageFor(raw);
    } finally {
      this.googleLoading = false;
    }
  }

  private async exchangeGoogleToken(phone?: string): Promise<void> {
    if (!this.googleIdToken) {
      return;
    }
    const res = await this.google.signIn(this.googleIdToken, phone);
    if (res.needsProfile) {
      // Cuenta nueva: el negocio necesita un teléfono para avisarte de tus
      // citas. Se pide aquí mismo en vez de mandar a otra pantalla.
      this.needsPhone = true;
      return;
    }
    await this.session.onRegistered();
    this.router.navigateByUrl(this.returnTo);
  }

  get recoverQuery(): Record<string, string> {
    const email = this.username.trim();
    return email ? { email } : {};
  }
}

/** El mensaje que ve el usuario. El del servidor manda cuando lo hay. */
function messageFor(error: ApiError): string {
  if (error.networkError) return 'Sin conexión con el servidor.';
  if (error.status === 401 || error.status === 400) return 'Usuario o contraseña incorrectos.';
  if (error.isTooManyRequests) return 'Demasiados intentos. Espera un momento.';
  return error.message || 'No hemos podido iniciar sesión. Inténtalo de nuevo.';
}

function googleMessageFor(raw: unknown): string {
  const error = ApiError.from(raw);
  if (error.networkError) return 'Sin conexión con el servidor.';
  if (error.status > 0) return error.message;
  return 'No se pudo continuar con Google. Inténtalo de nuevo.';
}
