import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { TokenStorageService } from '../core/token-storage.service';
import {
  AuthResponse,
  LoginRequest,
  RegisterCustomerRequest,
  SendCodeResult,
  VerifyCodeResult,
} from '../models/bipsy.models';

/**
 * Login, alta y recuperación de contraseña. Port de `AuthRepository`.
 *
 * Persiste los tokens tras cada autenticación: quien llama no tiene que
 * acordarse de guardarlos.
 */
@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);

  /**
   * El campo se llama `username` y no `email`: el servidor acepta los dos en
   * él, pero espera esa clave. Mandando `email` el login devolvía siempre 400.
   */
  async login(req: LoginRequest): Promise<AuthResponse> {
    // Desde la V105 el servidor espera `email`; el formulario lo sigue
    // llamando `username` por dentro.
    const auth = await this.api.post<AuthResponse>(
      '/auth/login',
      { email: req.username, password: req.password },
      false,
    );
    this.tokens.save(auth);
    return auth;
  }

  // ----- ALTA POR PASOS --------------------

  /**
   * Manda un código de 6 dígitos al correo para empezar el alta.
   *
   * 409 si ese correo ya tiene cuenta; 429 si se pide otro antes de tiempo.
   */
  sendSignupCode(email: string): Promise<SendCodeResult> {
    return this.api.post<SendCodeResult>('/auth/signup/send-code', { email }, false);
  }

  /**
   * Canjea el código por el token con el que se crea la cuenta.
   *
   * No inicia sesión: ese token solo sirve para el registro.
   */
  verifySignupCode(email: string, code: string): Promise<VerifyCodeResult> {
    return this.api.post<VerifyCodeResult>('/auth/signup/verify-code', { email, code }, false);
  }

  async registerCustomer(req: RegisterCustomerRequest): Promise<AuthResponse> {
    const auth = await this.api.post<AuthResponse>('/auth/register/customer', req, false);
    this.tokens.save(auth);
    return auth;
  }

  // ----- RECUPERAR LA CONTRASEÑA --------------------

  /**
   * Pide un código para recuperar la contraseña.
   *
   * No falla aunque el correo no tenga cuenta: el servidor responde igual en
   * los dos casos para no convertirse en un detector de quién está registrado.
   * La web dice lo mismo pase lo que pase.
   */
  forgotPassword(email: string): Promise<void> {
    return this.api.post<void>('/auth/password/forgot', { email }, false);
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<string> {
    const res = await this.api.post<{ resetToken: string }>(
      '/auth/password/verify-code',
      { email, code },
      false,
    );
    return res.resetToken;
  }

  /**
   * Cambia la contraseña y cierra las sesiones abiertas.
   *
   * No devuelve sesión: después hay que entrar con la nueva, que es lo que
   * confirma que ha quedado guardada.
   */
  resetPassword(resetToken: string, newPassword: string): Promise<void> {
    return this.api.post<void>('/auth/password/reset', { resetToken, newPassword }, false);
  }

  // ----- CERRAR SESIÓN --------------------

  async logout(): Promise<void> {
    const refreshToken = this.tokens.refreshToken;
    if (refreshToken) {
      try {
        await this.api.post<void>('/auth/logout', { refreshToken });
      } catch {
        // Si la llamada falla igual se limpia en local: lo que no puede pasar
        // es que el usuario pulse "cerrar sesión" y siga dentro.
      }
    }
    this.tokens.clear();
  }
}
