import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import {
  SocialAuthService,
  SocialIdentity,
  SocialProvider,
  SocialSignInCancelled,
  socialMessageFor,
} from '../../core/social-auth.service';
import { ButtonComponent } from '../button/button.component';
import { SocialButtonsComponent } from '../social-buttons/social-buttons.component';
import { isValidEmail, isValidPhone } from '../../shared/validation';

/**
 * El formulario de acceso. **Uno solo, para los dos sitios que entran.**
 *
 * Es el de `/acceder` tal cual —correo, contraseña con el ojo, el enlace de
 * «he olvidado mi contraseña», Google y Apple debajo y el pie para crear
 * cuenta—, extraído aquí porque el paso de entrada de la reserva se había
 * escrito aparte: dos campos y los botones sociales, sin el ojo y sin el enlace
 * de recuperar. Una puerta que se parece a la de casa pero no es la de casa es
 * exactamente lo que no se le puede poner delante a alguien al que se le pide
 * su contraseña.
 *
 * Quien lo usa no se entera de cómo se ha entrado: hace su trabajo —incluido
 * pedir el teléfono que ni Google ni Apple dan— y avisa con `signedIn` cuando
 * ya hay sesión. Ni rutas ni navegación: eso lo decide la pantalla.
 */
@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent, SocialButtonsComponent],
  templateUrl: './login-form.component.html',
})
export class LoginFormComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly social = inject(SocialAuthService);

  /** Encabezado, si la pantalla quiere uno. El acceso entra sin título. */
  @Input() title: string | null = null;
  @Input() subtitle: string | null = null;

  /** Lo que dice el botón. Cambia porque entrar no siempre es el final. */
  @Input() submitLabel = 'Iniciar sesión';

  /** Correo ya conocido, para no hacerlo escribir dos veces. */
  @Input() email = '';

  /** Un aviso de la pantalla —«contraseña cambiada»— sobre el botón. */
  @Input() notice: string | null = null;

  /** A dónde volver si acaba creando cuenta. Null: a donde lleve el alta. */
  @Input() returnTo: string | null = null;

  /** Ya hay sesión. La pantalla decide qué pasa después. */
  @Output() signedIn = new EventEmitter<void>();

  username = '';
  password = '';
  showPassword = false;
  loading = false;
  error: string | null = null;

  /** Cuál de los dos botones está girando. Null si ninguno. */
  socialLoading: SocialProvider | null = null;

  /** Cuenta nueva con Google o Apple: falta el teléfono antes de entrar. */
  needsPhone = false;

  /**
   * Y además el correo, porque Apple no lo ha dado.
   *
   * Apple entrega el correo una única vez, la primera que se autoriza la app.
   * Si esa vez fue en otro sitio, el token llega sin él.
   */
  needsEmail = false;
  phone = '';
  private identity: SocialIdentity | null = null;

  ngOnInit(): void {
    this.username = this.email;
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
      this.done();
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
      // Cancelar no es un error: cerró la ventana y sigue donde estaba.
      if (raw instanceof SocialSignInCancelled) {
        return;
      }
      this.error = socialMessageFor(raw, provider);
    } finally {
      this.socialLoading = null;
    }
  }

  /** Segundo intento, ya con el teléfono (y el correo) que pidió el servidor. */
  async submitProfile(): Promise<void> {
    const problema = this.needsEmail && !isValidEmail(this.username.trim())
      ? 'Ese correo no parece válido.'
      : !isValidPhone(this.phone) ? 'Introduce tu teléfono' : null;
    if (problema) {
      this.error = problema;
      return;
    }
    const provider = this.identity?.provider ?? 'google';
    this.socialLoading = provider;
    this.error = null;
    try {
      await this.exchangeToken();
    } catch (raw) {
      this.error = socialMessageFor(raw, provider);
    } finally {
      this.socialLoading = null;
    }
  }

  /**
   * Canjea la identidad por la sesión, pidiendo lo que falte.
   *
   * El teléfono es obligatorio para el alta y ninguno de los dos proveedores lo
   * da. El correo solo falta con Apple, y entonces la cuenta nace sin verificar
   * — lo que la verifica después es que le llegue algo a esa dirección.
   */
  private async exchangeToken(): Promise<void> {
    if (!this.identity) {
      return;
    }
    const res = await this.social.signIn(
      this.identity,
      this.phone.trim() || undefined,
      this.username.trim() || undefined,
    );

    if (res.needsProfile) {
      // Cuenta nueva: el negocio necesita un teléfono para avisarte de tus
      // citas. Se pide aquí mismo en vez de mandar a otra pantalla.
      if (res.email) {
        this.username = res.email;
      }
      this.needsPhone = true;
      this.needsEmail = !res.email;
      return;
    }

    await this.session.onRegistered();
    this.done();
  }

  /** Ya hay sesión. Nada se queda en memoria más de lo que hace falta. */
  private done(): void {
    this.password = '';
    this.needsPhone = false;
    this.needsEmail = false;
    this.identity = null;
    this.signedIn.emit();
  }

  get recoverQuery(): Record<string, string> {
    const email = this.username.trim();
    return email ? { email } : {};
  }

  /** El alta, con el correo escrito y la vuelta a donde se estaba. */
  get signupQuery(): Record<string, string> {
    const email = this.username.trim();
    return {
      ...(email ? { email } : {}),
      ...(this.returnTo ? { returnTo: this.returnTo } : {}),
    };
  }
}

/** El mensaje que ve el usuario. El del servidor manda cuando lo hay. */
function messageFor(error: ApiError): string {
  if (error.networkError) return 'Sin conexión con el servidor.';
  if (error.status === 401 || error.status === 400) return 'Usuario o contraseña incorrectos.';
  if (error.isTooManyRequests) return 'Demasiados intentos. Espera un momento.';
  return error.message || 'No hemos podido iniciar sesión. Inténtalo de nuevo.';
}
