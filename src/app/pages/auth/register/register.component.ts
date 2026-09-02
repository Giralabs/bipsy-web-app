import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api-error';
import { SessionService } from '../../../core/session.service';
import { GoogleAuthService, GoogleSignInCancelled } from '../../../core/google-auth.service';
import { AuthRepository } from '../../../repositories/auth.repository';
import { ButtonComponent } from '../../../components/button/button.component';

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
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthRepository);
  private readonly session = inject(SessionService);
  private readonly google = inject(GoogleAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
  private returnTo = '/home';

  // ----- GOOGLE --------------------
  //
  // Con Google el correo llega ya verificado, así que el alta se salta los dos
  // primeros pasos: solo queda el teléfono, y solo si la cuenta es nueva.
  googleLoading = false;
  needsPhone = false;
  private googleIdToken: string | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    this.email = params['email'] ?? '';
    this.returnTo = params['returnTo'] ?? this.session.takeReturnTo() ?? '/home';
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  get googleAvailable(): boolean {
    return this.google.isAvailable;
  }

  async signUpWithGoogle(): Promise<void> {
    if (this.loading || this.googleLoading) {
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
      const error = ApiError.from(raw);
      this.error = error.status > 0
        ? error.message
        : 'No se pudo continuar con Google. Inténtalo de nuevo.';
    } finally {
      this.googleLoading = false;
    }
  }

  async submitGooglePhone(): Promise<void> {
    if (this.phone.trim().length < 9) {
      this.error = 'Introduce tu teléfono';
      return;
    }
    this.googleLoading = true;
    this.error = null;
    try {
      await this.exchangeGoogleToken(this.phone.trim());
    } catch (raw) {
      this.error = ApiError.from(raw).message;
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
      const res = await this.auth.sendSignupCode(email);
      this.email = email;
      this.startTimer(res.resendInSeconds);
      this.step = 'code';
    }, error => {
      // Ese correo ya tiene cuenta: se manda a entrar con él escrito, en vez
      // de dejarle repitiendo un alta que nunca va a salir.
      if (error.isConflict) {
        this.router.navigate(['/acceder'], { queryParams: { email, returnTo: this.returnTo } });
        return null;
      }
      if (error.isTooManyRequests) return error.message;
      return 'No hemos podido enviarte el código. Inténtalo de nuevo.';
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
    if (this.name.trim().length < 2) {
      this.error = 'Introduce tu nombre';
      return;
    }
    if (this.phone.trim().length < 9) {
      this.error = 'Teléfono demasiado corto';
      return;
    }
    const passwordError = validatePassword(this.password);
    if (passwordError) {
      this.error = passwordError;
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 120;
}

/**
 * La misma regla que aplica el servidor (`@StrongPassword`). Sin esto el fallo
 * salía al final, al crear la cuenta, después de haber rellenado todo.
 */
function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Mínimo 8 caracteres';
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return 'Añade al menos una letra y un número';
  }
  return null;
}
