import { ErrorHandler, Injectable, Injector, NgZone, inject } from '@angular/core';
import { NavigationError, RedirectCommand, Router } from '@angular/router';

/** Los tres motivos que sabe contar la página de error. Van en `?tipo=`. */
export type ErrorKind = 'inesperado' | 'conexion' | 'version';

/** Dónde vive la página de error. */
export const ERROR_PATH = '/error';

/**
 * Cómo dice cada navegador que no ha podido traer un trozo de la web.
 *
 * Cada página se carga en diferido y sus ficheros llevan un hash en el nombre.
 * Tras un despliegue, una pestaña que seguía abierta pide el fichero antiguo,
 * que ya no existe: Chrome, Firefox y Safari lo cuentan cada uno a su manera,
 * y los empaquetadores antiguos con `ChunkLoadError`.
 */
const CHUNK_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

/** Si [error] es un trozo de la web que no ha llegado, y no un fallo del código. */
export function isChunkLoadFailure(error: unknown): boolean {
  // Una promesa rechazada sin `catch` llega envuelta: el fallo real va dentro.
  const inner = (error as { rejection?: unknown } | null)?.rejection ?? error;
  const { name, message } = (inner ?? {}) as { name?: unknown; message?: unknown };
  return CHUNK_FAILURE.test(`${name ?? ''} ${message ?? inner}`);
}

/** Si [url] ya es la página de error. Es lo que impide dar vueltas. */
export function isErrorPage(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return path === ERROR_PATH || path.startsWith(`${ERROR_PATH}/`);
}

/**
 * La dirección de la página de error para un trozo que no ha llegado estando
 * en —o yendo a— [from].
 *
 * Sin red, el motivo es la red: decirle a quien va en el metro que "hay una
 * versión nueva" le manda a recargar para nada.
 */
export function chunkFailureUrl(from: string): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const kind: ErrorKind = offline ? 'conexion' : 'version';
  return `${ERROR_PATH}?tipo=${kind}&desde=${encodeURIComponent(from)}`;
}

/**
 * Gancho de errores de navegación del router (`withNavigationErrorHandler`).
 *
 * Cuando lo que falla es la carga de la página a la que se iba, la navegación
 * se redirige a la de error en vez de romperse en silencio —el enlace pulsado
 * no hacía nada y la consola se llenaba de rojo—. Cualquier otro fallo se deja
 * pasar tal cual.
 */
export function onNavigationError(event: NavigationError): RedirectCommand | void {
  if (!isChunkLoadFailure(event.error) || isErrorPage(event.url)) {
    return;
  }
  return new RedirectCommand(inject(Router).parseUrl(chunkFailureUrl(event.url)));
}

/**
 * El `ErrorHandler` de la web.
 *
 * Hace lo de siempre —dejar el error en la consola— y una sola cosa más:
 * cuando el fallo es un trozo de la web que no ha llegado, lleva a la página
 * que ofrece recargar. Es la red de seguridad de [onNavigationError], para los
 * `import()` que no pasan por el router.
 *
 * **No secuestra el resto.** Un error cualquiera en una pantalla no justifica
 * echar a nadie de ella: casi siempre la pantalla sigue sirviendo, y mandar a
 * una página de error por cada excepción convierte un fallo menor en uno total.
 *
 * **No puede dar vueltas**, por tres motivos que no dependen unos de otros:
 * estando ya en la página de error no hace nada; esa página va en el paquete
 * inicial y no en un trozo aparte, así que llegar a ella no puede fallar por lo
 * mismo; y de ella solo se sale porque alguien pulsa un botón.
 */
@Injectable()
export class AppErrorHandler extends ErrorHandler {
  // El Router se pide al usarlo y no al construir: él mismo depende del
  // `ErrorHandler`, y pedirlo aquí arriba cerraría el círculo.
  private readonly injector = inject(Injector);
  private readonly zone = inject(NgZone);

  /** Ya se está yendo a la página de error. */
  private leaving = false;

  override handleError(error: unknown): void {
    super.handleError(error);

    if (this.leaving || !isChunkLoadFailure(error)) {
      return;
    }
    const router = this.injector.get(Router);
    if (isErrorPage(router.url)) {
      return;
    }

    this.leaving = true;
    // Los errores llegan a veces desde fuera de la zona de Angular, y una
    // navegación lanzada ahí no repinta.
    this.zone.run(() => {
      void router
        .navigateByUrl(chunkFailureUrl(router.url))
        .catch(() => false)
        .finally(() => (this.leaving = false));
    });
  }
}
