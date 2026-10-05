import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, firstValueFrom, throwError, timeout } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiError } from './api-error';
import { TokenStorageService } from './token-storage.service';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Tiempo máximo de una petición. Los mismos 20 s que el `receiveTimeout` de
 * `ApiClient` en las apps.
 *
 * Sin esto, un servidor dormido —el plan gratuito de Render tarda medio minuto
 * en despertar— dejaba la portada girando para siempre: ni datos, ni error, ni
 * forma de reintentar.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Cliente HTTP único de la web. Port de `ApiClient` (gipsi_api).
 *
 * Hace tres cosas y ninguna la hace la UI:
 *  - Inyecta `Authorization: Bearer`, saltándose `/auth/login|refresh` y el
 *    alta (que no tienen sesión que mandar).
 *  - Captura el 401, refresca contra `/auth/refresh` y **reintenta una vez**.
 *    Si llegan N peticiones con 401 a la vez, **solo una** refresca y el resto
 *    espera: sin ese cerrojo, cinco peticiones simultáneas rotaban el refresh
 *    token cinco veces y las cuatro últimas se encontraban uno ya usado.
 *  - Traduce cualquier fallo a [ApiError].
 *
 * **La UI nunca toca HttpClient.** Página → servicio → repositorio → aquí.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);

  readonly baseUrl = resolveApiUrl();

  /** La sesión se ha ido y no se ha podido recuperar. */
  private readonly sessionExpiredSubject = new Subject<void>();
  readonly sessionExpired$ = this.sessionExpiredSubject.asObservable();

  /** El cerrojo del refresco. Null mientras no haya ninguno en marcha. */
  private refreshing: Promise<boolean> | null = null;

  /**
   * `headers` son cabeceras de más para ESTA llamada. Solo las usa la consulta
   * de mantenimiento, que manda su propio pase en `X-Bipsy-Maintenance`: no es
   * la sesión de nadie y por eso no viaja en `Authorization`.
   */
  get<T>(
    path: string,
    params?: QueryParams,
    auth = true,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, params, auth, headers);
  }

  post<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('POST', path, body, undefined, auth);
  }

  put<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('PUT', path, body, undefined, auth);
  }

  delete<T>(path: string, body?: unknown, auth = true): Promise<T> {
    return this.request<T>('DELETE', path, body, undefined, auth);
  }

  /**
   * Sube un fichero. `multipart/form-data` sin cabecera `Content-Type`: la
   * pone el navegador con el `boundary`, y escribirla a mano lo rompe.
   */
  postMultipart<T>(path: string, form: FormData): Promise<T> {
    return this.request<T>('POST', path, form, undefined, true);
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    params: QueryParams | undefined,
    auth: boolean,
    extraHeaders?: Record<string, string>,
    retried = false,
  ): Promise<T> {
    try {
      return await firstValueFrom(
        (this.http.request<T>(method, this.baseUrl + path, {
          body,
          params: buildParams(params),
          headers: { ...this.headersFor(auth, body), ...extraHeaders },
          responseType: 'json',
        }) as Observable<T>).pipe(
          timeout(REQUEST_TIMEOUT_MS),
          // Un tiempo agotado se cuenta como fallo de red: para quien mira la
          // pantalla es lo mismo que no haber podido conectar, y es lo que
          // decide si se ofrece reintentar.
          catchError(err =>
            err?.name === 'TimeoutError'
              ? throwError(() => new ApiError(
                  0,
                  'Bipsy ha tardado demasiado en responder. Inténtalo de nuevo.',
                  undefined,
                  true,
                ))
              : throwError(() => err),
          ),
        ),
      );
    } catch (raw) {
      const error = ApiError.from(raw);

      // Un 401 significa "access token caducado" → refrescar y reintentar.
      // Solo una vez: si el reintento vuelve a dar 401, el problema no es el
      // token y otro ciclo sería un bucle.
      if (error.isUnauthorized && auth && !retried && this.tokens.refreshToken) {
        const ok = await this.refreshSession();
        if (ok) {
          return this.request<T>(method, path, body, params, auth, extraHeaders, true);
        }
      }
      throw error;
    }
  }

  private headersFor(auth: boolean, body: unknown): Record<string, string> {
    // En qué app se pregunta: desde la V105 del backend un mismo correo puede
    // tener cuenta de cliente y cuenta profesional, y entrar, recuperar la
    // contraseña y el alta responden 400 sin esta cabecera.
    const headers: Record<string, string> = { 'X-Bipsy-Scope': 'CUSTOMER' };
    // FormData lleva su propio Content-Type con boundary.
    if (!(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const token = auth ? this.tokens.accessToken : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Rota los dos tokens. Devuelve si la sesión sigue viva.
   *
   * El refresco va con `auth: false` a propósito: mandar el access token
   * caducado no aporta nada y algunas pasarelas lo rechazan antes de llegar.
   */
  private refreshSession(): Promise<boolean> {
    if (this.refreshing) {
      return this.refreshing;
    }

    this.refreshing = (async () => {
      const refreshToken = this.tokens.refreshToken;
      if (!refreshToken) {
        return false;
      }
      try {
        const auth = await firstValueFrom(
          this.http.post<{ accessToken: string; refreshToken: string; role?: string; actorId?: number }>(
            `${this.baseUrl}/auth/refresh`,
            { refreshToken },
            { headers: { 'Content-Type': 'application/json', 'X-Bipsy-Scope': 'CUSTOMER' } },
          ),
        );
        this.tokens.save(auth);
        return true;
      } catch {
        this.tokens.clear();
        this.sessionExpiredSubject.next();
        return false;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }
}

/**
 * A qué API se habla.
 *
 * Normalmente la de `environment`, que el `fileReplacements` de angular.json
 * sustituye por la de desarrollo al servir. Pero ese reemplazo **solo se aplica
 * al arrancar `ng serve`**: un servidor levantado antes de tocar la
 * configuración sigue apuntando a producción, y entonces la web pide los datos
 * a un servidor remoto —dormido, en el plan gratis— mientras el backend local
 * está ahí al lado. El síntoma es una portada cargando para siempre y cuesta
 * media hora encontrarlo.
 *
 * Servida desde `localhost` es, por definición, una compilación de desarrollo:
 * ahí manda el backend local.
 */
function resolveApiUrl(): string {
  const configured = environment.apiUrl;
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  if (isLocal && !configured.includes('localhost')) {
    console.info('[Bipsy] Servida desde localhost: se usa http://localhost:8080 como API.');
    return 'http://localhost:8080';
  }
  return configured;
}

function buildParams(params?: QueryParams): HttpParams | undefined {
  if (!params) {
    return undefined;
  }
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}
