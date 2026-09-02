import { Injectable } from '@angular/core';

/**
 * Los dos tokens de la sesión. Port de `TokenStorage` (gipsi_api).
 *
 * En las apps viven en el llavero del sistema; en el navegador no hay
 * equivalente, así que van a `localStorage`. Es una decisión consciente y con
 * coste: cualquier XSS los lee. La alternativa —cookie `HttpOnly`— la tiene
 * que emitir el backend, y hoy devuelve los tokens en el cuerpo.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private static readonly ACCESS = 'bipsy_auth_token';
  private static readonly REFRESH = 'bipsy_refresh_token';
  private static readonly ROLE = 'bipsy_role';
  private static readonly ACTOR = 'bipsy_actor_id';

  get accessToken(): string | null {
    return this.read(TokenStorageService.ACCESS);
  }

  get refreshToken(): string | null {
    return this.read(TokenStorageService.REFRESH);
  }

  get role(): string | null {
    return this.read(TokenStorageService.ROLE);
  }

  get actorId(): number | null {
    const raw = this.read(TokenStorageService.ACTOR);
    return raw ? Number(raw) : null;
  }

  get hasSession(): boolean {
    return !!this.accessToken;
  }

  save(tokens: { accessToken: string; refreshToken?: string; role?: string; actorId?: number }): void {
    this.write(TokenStorageService.ACCESS, tokens.accessToken);
    if (tokens.refreshToken) this.write(TokenStorageService.REFRESH, tokens.refreshToken);
    if (tokens.role) this.write(TokenStorageService.ROLE, tokens.role);
    if (tokens.actorId != null) this.write(TokenStorageService.ACTOR, String(tokens.actorId));
  }

  clear(): void {
    [
      TokenStorageService.ACCESS,
      TokenStorageService.REFRESH,
      TokenStorageService.ROLE,
      TokenStorageService.ACTOR,
    ].forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Navegación privada con almacenamiento bloqueado: no hay nada que
        // borrar y tampoco nada que avisar.
      }
    });
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento la sesión dura lo que la pestaña. Peor que fallar
      // la petición entera por no poder guardar el token.
    }
  }
}
