import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/api-error';
import { AuthRepository } from '../../../repositories/auth.repository';
import { ButtonComponent } from '../../../components/button/button.component';

type Step = 'email' | 'code' | 'password';

/**
 * Recuperar la contraseña en tres pasos. Port de `RecoverPasswordScreen`.
 *
 * El primer paso responde lo mismo exista o no la cuenta: el servidor lo hace
 * así para no convertirse en un detector de quién está registrado, y la web
 * dice lo mismo pase lo que pase.
 */
@Component({
  selector: 'app-recover',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonComponent],
  templateUrl: './recover.component.html',
})
export class RecoverComponent implements OnInit {
  private readonly auth = inject(AuthRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  step: Step = 'email';
  loading = false;
  error: string | null = null;

  email = '';
  code = '';
  password = '';
  showPassword = false;

  private resetToken: string | null = null;

  ngOnInit(): void {
    this.email = this.route.snapshot.queryParams['email'] ?? '';
  }

  async submitEmail(): Promise<void> {
    const email = this.email.trim().toLowerCase();
    if (!email) {
      this.error = 'Escribe tu correo electrónico';
      return;
    }
    await this.run(async () => {
      await this.auth.forgotPassword(email);
      this.email = email;
      this.step = 'code';
    }, 'No hemos podido enviarte el código.');
  }

  async submitCode(): Promise<void> {
    if (this.code.trim().length !== 6) {
      this.error = 'El código son 6 dígitos';
      return;
    }
    await this.run(async () => {
      this.resetToken = await this.auth.verifyPasswordResetCode(this.email, this.code.trim());
      this.step = 'password';
    }, 'No hemos podido comprobar el código.');
  }

  async submitPassword(): Promise<void> {
    if (!this.resetToken) {
      this.step = 'email';
      return;
    }
    const problem = validatePassword(this.password);
    if (problem) {
      this.error = problem;
      return;
    }
    await this.run(async () => {
      await this.auth.resetPassword(this.resetToken!, this.password);
      // No devuelve sesión: hay que entrar con la nueva, que es lo que
      // confirma que ha quedado guardada.
      this.router.navigate(['/acceder'], {
        queryParams: { email: this.email, changed: 1 },
      });
    }, 'No hemos podido cambiar tu contraseña.');
  }

  back(): void {
    this.error = null;
    if (this.step === 'code') {
      this.step = 'email';
    } else if (this.step === 'password') {
      this.step = 'code';
    }
  }

  private async run(action: () => Promise<void>, fallback: string): Promise<void> {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      await action();
    } catch (raw) {
      const error = ApiError.from(raw);
      this.error = error.networkError ? 'Sin conexión. Comprueba tu red.' : fallback;
    } finally {
      this.loading = false;
    }
  }
}

/** La misma regla que aplica el servidor (`@StrongPassword`). */
function validatePassword(value: string): string | null {
  if (value.length < 8) {
    return 'Mínimo 8 caracteres';
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return 'Añade al menos una letra y un número';
  }
  return null;
}
