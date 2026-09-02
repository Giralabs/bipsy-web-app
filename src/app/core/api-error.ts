import { HttpErrorResponse } from '@angular/common/http';

/**
 * El ÚNICO error que ve la UI. Port de `ApiException` (gipsi_api).
 *
 * La pantalla no debe mirar nunca un `HttpErrorResponse`: lo que necesita es
 * el código, el mensaje que el backend ya escribió en español y si la petición
 * llegó a salir.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** `error` del `ApiError` del backend: `SUBSCRIPTION_REQUIRED`, etc. */
    readonly code?: string,
    /** La petición no llegó a salir: sin red o servidor inalcanzable. */
    readonly networkError = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized(): boolean { return this.status === 401; }
  get isForbidden(): boolean { return this.status === 403; }
  get isNotFound(): boolean { return this.status === 404; }
  get isConflict(): boolean { return this.status === 409; }
  get isTooManyRequests(): boolean { return this.status === 429; }
  /** Función no incluida en el plan, o tarjeta obligatoria al reservar. */
  get isPaymentRequired(): boolean { return this.status === 402; }

  /**
   * Traduce la respuesta de Angular al error de la casa.
   *
   * `status === 0` es la señal de que el navegador ni siquiera pudo conectar:
   * un mensaje de "error del servidor" ahí es mentira y manda al usuario a
   * mirar donde no es.
   */
  static from(err: unknown): ApiError {
    if (err instanceof ApiError) {
      return err;
    }
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return new ApiError(
          0,
          'No hemos podido conectar con Bipsy. Comprueba tu conexión a internet.',
          undefined,
          true,
        );
      }
      const body = err.error as { message?: string; error?: string } | null;
      return new ApiError(
        err.status,
        body?.message?.trim() || defaultMessageFor(err.status),
        body?.error,
      );
    }
    return new ApiError(-1, 'Algo no ha ido bien. Inténtalo de nuevo.');
  }
}

function defaultMessageFor(status: number): string {
  switch (status) {
    case 400: return 'Los datos enviados no son válidos.';
    case 401: return 'Tu sesión ha caducado. Vuelve a entrar.';
    case 403: return 'No tienes permiso para hacer esto.';
    case 404: return 'No hemos encontrado lo que buscabas.';
    case 409: return 'Eso ya existe.';
    case 429: return 'Has hecho demasiadas peticiones. Espera un momento.';
    case 503: return 'El servicio no está disponible ahora mismo.';
    default:  return 'Algo no ha ido bien. Inténtalo de nuevo.';
  }
}
