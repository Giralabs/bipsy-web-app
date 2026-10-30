import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
import { AuthRepository } from '../../../repositories/auth.repository';
import { ButtonComponent } from '../../../components/button/button.component';
import { DialogService } from '../../../core/dialog.service';
import { isValidEmail } from '../../../shared/validation';
import { confirmPhone } from '../../../shared/confirm-phone';
import { newPasswordError } from '../../../shared/password-policy';
import { PasswordRulesComponent } from '../../../shared/password-rules.component';
import { AuthAsideComponent } from '../auth-aside.component';
import { SocialButtonsComponent } from '../../../components/social-buttons/social-buttons.component';

type Step = 'email' | 'code' | 'profile';

/**
 * Alta de cliente por pasos. Port de `SignupFlowScreen` (pasos 1, 2 y 3).
 *
 * El correo se verifica ANTES de crear nada: el servidor manda un código de 6
 * dígitos y lo canjea por un `signupToken`. El correo viaja dentro de ese
 * token y no como un campo aparte — si fuera aparte, bastaría con cambiarlo
 * para crear una cuenta con el correo de otro.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [AuthAsideComponent, CommonModule, FormsModule, RouterLink, ButtonComponent, SocialButtonsComponent, PasswordRulesComponent],
  templateUrl: './register.component.html',
  styleUrl: '../auth-layout.css',
})
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthRepository);
  private readonly session = inject(SessionService);
  private readonly social = inject(SocialAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(DialogService);

  step: Step = 'email';
  loading = false;
  error: string | null = null;

  email = '';
  code = '';
  name = '';
  phone = '';
  password = '';
  referralCode = '';
  showPassword = false;

  /** Segundos que faltan para poder pedir otro código. Lo dice el servidor. */
  resendInSeconds = 0;
  private timer?: ReturnType<typeof setInterval>;

  private signupToken: string | null = null;
  private returnTo = '/';

  // ----- GOOGLE Y APPLE --------------------
  //
  // Con cualquiera de los dos el correo llega ya verificado, así que el alta se
  // salta los dos primeros pasos: solo queda el teléfono, y solo si la cuenta
  // es nueva.
  //
  // Con Apple, además, el nombre solo llega la PRIMERA vez que se autoriza:
  // viaja en la identidad hasta el backend, que es quien lo guarda al crear la
  // cuenta.
  socialLoading: SocialProvider | null = null;
  needsPhone = false;
  private identity: SocialIdentity | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.email = params['email'] ?? '';
    this.returnTo = params['returnTo'] ?? this.session.takeReturnTo() ?? '/';
    // El enlace de invitación de un negocio (`/invitacion/<código>`) trae aquí
    // su código ya puesto, como hace la app al abrir el alta desde el enlace:
    // escribirlo a mano es donde se pierden las invitaciones.
    const ref = params['ref'];
    if (typeof ref === 'string') {
      this.referralCode = ref.trim().slice(0, 32);
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
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

  async signUpWith(provider: SocialProvider): Promise<void> {
    if (this.loading || this.socialLoading) {
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

  async submitSocialPhone(): Promise<void> {
    if (this.phone.trim().length < 9) {
      this.error = 'Introduce tu teléfono';
      return;
    }
    // Esta pantalla existe justo para pedir el teléfono: no releerlo aquí
    // sería peor que en el alta normal.
    if (!(await confirmPhone(this.dialog, this.phone))) {
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
      this.needsPhone = true;
      return;
    }
    await this.session.onRegistered();
    this.router.navigateByUrl(this.returnTo);
  }

  // ----- PASO 1: CORREO --------------------

  async submitEmail(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      this.error = 'Ese correo no parece válido';
      return;
    }

    await this.run(async () => {
      // Antes de mandar el código: el 409 de `send-code` no dice si la cuenta
      // es de Google, y a esa no se la puede mandar a escribir una contraseña
      // que nunca eligió.
      const status = await this.auth.signupEmailStatus(email);
      if (status !== 'free') {
        this.goToLogin(email, status === 'takenGoogle');
        return;
      }
      const res = await this.auth.sendSignupCode(email);
      this.email = email;
      this.startTimer(res.resendInSeconds);
      this.step = 'code';
    }, error => {
      // Ese correo ya tiene cuenta: se manda a entrar con él escrito, en vez
      // de dejarle repitiendo un alta que nunca va a salir. Sigue haciendo
      // falta aunque se pregunte antes: entre las dos llamadas puede crearse.
      if (error.isConflict) {
        this.goToLogin(email, false);
        return null;
      }
      if (error.isTooManyRequests) return error.message;
      return 'No hemos podido enviarte el código. Inténtalo de nuevo.';
    });
  }

  /** Con `google=1` el acceso avisa de que esa cuenta entra con Google. */
  private goToLogin(email: string, withGoogle: boolean): void {
    this.router.navigate(['/acceder'], {
      queryParams: { email, returnTo: this.returnTo, ...(withGoogle ? { google: 1 } : {}) },
    });
  }

  // ----- PASO 2: CÓDIGO --------------------

  async submitCode(): Promise<void> {
    const code = this.code.trim();
    if (code.length !== 6) {
      this.error = 'El código son 6 dígitos';
      return;
    }

    await this.run(async () => {
      const res = await this.auth.verifySignupCode(this.email, code);
      this.signupToken = res.signupToken;
      this.stopTimer();
      this.step = 'profile';
    }, () => 'No hemos podido comprobar el código. Inténtalo de nuevo.');
  }

  async resendCode(): Promise<void> {
    if (this.resendInSeconds > 0) {
      return;
    }
    await this.run(async () => {
      const res = await this.auth.sendSignupCode(this.email);
      this.startTimer(res.resendInSeconds);
    }, () => 'No hemos podido enviarte otro código.');
  }

  // ----- PASO 3: DATOS --------------------

  async submitProfile(): Promise<void> {
    if (!this.signupToken) {
      this.step = 'email';
      return;
    }
    if (!this.name.trim()) {
      this.error = 'Introduce tu nombre';
      return;
    }
    if (this.name.trim().length < 2) {
      this.error = 'Nombre demasiado corto';
      return;
    }
    if (this.phone.trim().length < 9) {
      this.error = 'Teléfono demasiado corto';
      return;
    }
    const passwordError = newPasswordError(this.password);
    if (passwordError) {
      this.error = passwordError;
      return;
    }
    // Lo último antes de crear la cuenta: un número mal escrito no lo descubre
    // nadie hasta que el negocio necesita llamar.
    if (this.loading || !(await confirmPhone(this.dialog, this.phone))) {
      return;
    }

    await this.run(async () => {
      await this.auth.registerCustomer({
        signupToken: this.signupToken!,
        name: this.name.trim(),
        password: this.password,
        phone: this.phone.trim(),
        referralCode: this.referralCode.trim() || undefined,
      });
      await this.session.onRegistered();
      this.router.navigateByUrl(this.returnTo);
    }, error => error.message || 'No hemos podido crear tu cuenta. Inténtalo de nuevo.');
  }

  back(): void {
    this.error = null;
    if (this.step === 'code') {
      this.stopTimer();
      this.step = 'email';
    } else if (this.step === 'profile') {
      this.step = 'code';
    }
  }

  // ----- FONTANERÍA --------------------

  /**
   * Ejecuta el paso y traduce el fallo. El traductor puede devolver `null`
   * para decir "ya me he encargado" — es el caso del correo ocupado, que
   * navega en vez de enseñar un error.
   */
  private async run(
    action: () => Promise<void>,
    onError: (error: ApiError) => string | null,
  ): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      await action();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.networkError ? 'Sin conexión con el servidor.' : onError(error);
    } finally {
      this.loading = false;
    }
  }

  private startTimer(seconds: number): void {
    this.stopTimer();
    this.resendInSeconds = seconds;
    if (seconds <= 0) {
      return;
    }
    this.timer = setInterval(() => {
      this.resendInSeconds -= 1;
      if (this.resendInSeconds <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
