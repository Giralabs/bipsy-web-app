import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api-error';
import { SessionService } from '../../../core/session.service';
import {
  SocialAuthService,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  socialMessageFor,
} from '../../../core/social-auth.service';
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
  private readonly social = inject(SocialAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  username = '';
  password = '';
  showPassword = false;
  loading = false;
  error: string | null = null;
  notice: string | null = null;

  /** Cuál de los dos botones está girando. Null si ninguno. */
  socialLoading: SocialProvider | null = null;

  /** Cuenta nueva con Google o Apple: falta el teléfono antes de entrar. */
  needsPhone = false;
  phone = '';
  private identity: SocialIdentity | null = null;

  private returnTo = '/';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    // Quien escribe su correo para registrarse y resulta que ya tiene cuenta
    // no debería tener que volver a escribirlo aquí.
    this.username = params['email'] ?? '';
    this.returnTo = params['returnTo'] ?? this.session.takeReturnTo() ?? '/';
    if (params['changed']) {
      this.notice = 'Contraseña cambiada. Ya puedes entrar con ella.';
    }
  }

  get googleAvailable(): boolean {
    return this.social.googleAvailable;
  }

  get appleAvailable(): boolean {
    return this.social.appleAvailable;
  }

  /** Si hay algo social que ofrecer, y por tanto separador que pintar. */
  get socialAvailable(): boolean {
    return this.googleAvailable || this.appleAvailable;
  }

  get busy(): boolean {
    return this.loading || this.socialLoading !== null;
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

  // ----- GOOGLE Y APPLE --------------------

  async signInWith(provider: SocialProvider): Promise<void> {
    if (this.busy) {
      return;
    }
    this.socialLoading = provider;
    this.error = null;
    try {
      this.identity = await this.social.obtainIdentity(provider);
      await this.exchangeToken();
    } catch (raw) {
      if (raw instanceof SocialSignInCancelled) {
        return;
      }
      this.error = socialMessageFor(raw, provider);
    } finally {
      this.socialLoading = null;
    }
  }

  /** Segundo intento, ya con el teléfono que pidió el servidor. */
  async submitPhone(): Promise<void> {
    if (this.phone.trim().length < 9) {
      this.error = 'Introduce tu teléfono';
      return;
    }
    const provider = this.identity?.provider ?? 'google';
    this.socialLoading = provider;
    this.error = null;
    try {
      await this.exchangeToken(this.phone.trim());
    } catch (raw) {
      this.error = socialMessageFor(raw, provider);
    } finally {
      this.socialLoading = null;
    }
  }

  private async exchangeToken(phone?: string): Promise<void> {
    if (!this.identity) {
      return;
    }
    const res = await this.social.signIn(this.identity, phone);
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
