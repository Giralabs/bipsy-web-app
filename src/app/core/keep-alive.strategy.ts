import { ComponentRef, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, DetachedRouteHandle } from '@angular/router';

/** Tanto como se guarda una página apartada. Pasado esto, vuelve a cargarse. */
const KEEP_MS = 10 * 60_000;

interface Kept {
  handle: DetachedRouteHandle;
  at: number;
}

/**
 * Las páginas marcadas con `data: { keepAlive: true }` no se destruyen al
 * salir de ellas: se apartan tal cual y vuelven al regresar.
 *
 * Es lo que hace la app con Explorar. En la web, abrir un negocio y volver
 * atrás reconstruía la portada de cero: esqueletos, fotos cargando otra vez y,
 * como la posición se restauraba antes de que hubiera contenido, se acababa
 * arriba del todo o a media altura. Ahora vuelve igual que se dejó —la
 * categoría elegida, las filas desplazadas, el sitio de la página— en el mismo
 * fotograma, y lo que haya cambiado lo trae la propia página en silencio
 * (`onRevisit`).
 *
 * Solo diez minutos: más tiempo fuera y lo guardado ya no es lo que se espera
 * ver, así que se tira y la página arranca nueva.
 */
@Injectable()
export class KeepAliveStrategy extends BaseRouteReuseStrategy {
  private readonly kept = new Map<string, Kept>();

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return route.routeConfig?.data?.['keepAlive'] === true;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = keyOf(route);
    if (key === null) return;
    if (handle) {
      this.kept.set(key, { handle, at: Date.now() });
    } else {
      this.kept.delete(key);
    }
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = keyOf(route);
    if (key === null) return false;
    const kept = this.kept.get(key);
    if (!kept) return false;
    if (Date.now() - kept.at > KEEP_MS) {
      destroy(kept.handle);
      this.kept.delete(key);
      return false;
    }
    return true;
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = keyOf(route);
    return key === null ? null : this.kept.get(key)?.handle ?? null;
  }
}

function keyOf(route: ActivatedRouteSnapshot): string | null {
  if (route.routeConfig?.data?.['keepAlive'] !== true) return null;
  return route.routeConfig.path ?? '';
}

/** El handle que da Angular lleva dentro el componente; caducado, se destruye. */
function destroy(handle: DetachedRouteHandle): void {
  const ref = (handle as { componentRef?: ComponentRef<unknown> } | null)?.componentRef;
  ref?.destroy();
}
