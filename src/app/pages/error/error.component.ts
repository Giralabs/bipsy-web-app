import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ErrorKind, isErrorPage } from '../../core/app-error-handler';
import { PageMetaService } from '../../core/page-meta.service';
import { ButtonComponent } from '../../components/button/button.component';
import { StatusMascot, StatusPageComponent } from '../../components/status-page/status-page.component';

/** Lo que cambia de un motivo a otro. El armazón es el mismo. */
interface ErrorCopy {
  tabTitle: string;
  mascot: StatusMascot;
  heading: string;
  lead: string;
  /** El botón principal. */
  action: string;
  icon: string;
}

const COPY: Record<ErrorKind, ErrorCopy> = {
  inesperado: {
    tabTitle: 'Algo no ha ido bien',
    mascot: 'support',
    heading: 'Algo no ha ido bien',
    lead: 'Ha ocurrido un error inesperado y no es culpa tuya. Prueba otra vez y, si sigue igual, vuelve en unos minutos.',
    action: 'Reintentar',
    icon: 'refresh',
  },
  conexion: {
    tabTitle: 'Sin conexión',
    mascot: 'support',
    heading: 'No hemos podido conectar',
    lead: 'Puede que te hayas quedado sin internet o que Bipsy esté tardando en responder. Comprueba tu conexión y vuelve a intentarlo.',
    action: 'Reintentar',
    icon: 'refresh',
  },
  version: {
    tabTitle: 'Nueva versión disponible',
    mascot: 'hello',
    heading: 'Hay una versión nueva de Bipsy',
    lead: 'Hemos actualizado la web mientras la tenías abierta. Recarga y sigues justo donde estabas.',
    action: 'Recargar',
    icon: 'refresh',
  },
};

/**
 * Página de error. Un armazón y tres motivos:
 *
 *  - `inesperado` — algo ha fallado y no se sabe más. El de por defecto.
 *  - `conexion`   — sin red, o el servidor no responde.
 *  - `version`    — un trozo de la web no ha llegado porque se ha desplegado
 *                   una versión nueva con la pestaña abierta. Se arregla
 *                   recargando.
 *
 * El motivo llega en `?tipo=` o en el `data.kind` de la ruta; `?desde=` es la
 * dirección a la que volver, que es donde estaba —o a donde iba— quien acabó
 * aquí. Al `version` llega solo, desde `AppErrorHandler`; los otros dos están
 * para que cualquier pantalla pueda mandar aquí con `router.navigate`.
 *
 * ⚠️ **Va en el paquete inicial, no en diferido** (ver `app.routes.ts`): es la
 * página que se enseña cuando no se puede descargar una página.
 */
@Component({
  selector: 'app-error',
  standalone: true,
  imports: [StatusPageComponent, ButtonComponent],
  templateUrl: './error.component.html',
})
export class ErrorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meta = inject(PageMetaService);

  kind: ErrorKind = 'inesperado';
  copy = COPY.inesperado;

  /** A dónde lleva el botón principal. */
  private returnTo = '/';

  private releaseMeta: () => void = () => {};

  ngOnInit(): void {
    // `queryParamMap` y no `snapshot`: pasar de un motivo a otro reutiliza el
    // componente y con la foto fija se quedaría el texto anterior.
    this.route.queryParamMap.subscribe(params => {
      const asked = this.route.snapshot.data['kind'] ?? params.get('tipo');
      this.kind = isErrorKind(asked) ? asked : 'inesperado';
      this.copy = COPY[this.kind];
      this.returnTo = safeReturnTo(params.get('desde'));
      this.releaseMeta = this.meta.set(this.copy.tabTitle, true);
    });
  }

  /**
   * Vuelve a intentarlo.
   *
   * Con una versión nueva tiene que ser una recarga DE VERDAD: es lo único que
   * trae el `index.html` nuevo, y con él los nombres de los ficheros que sí
   * existen. `replace` para que "atrás" no devuelva a esta página. En los
   * otros dos basta con volver a navegar, sin perder lo que ya está cargado.
   */
  retry(): void {
    if (this.kind === 'version') {
      window.location.replace(this.returnTo);
      return;
    }
    void this.router.navigateByUrl(this.returnTo, { replaceUrl: true });
  }

  ngOnDestroy(): void {
    this.releaseMeta();
  }
}

function isErrorKind(value: unknown): value is ErrorKind {
  return typeof value === 'string' && value in COPY;
}

/**
 * La dirección de vuelta, solo si es una ruta de esta web.
 *
 * Viene en la URL, así que la puede escribir cualquiera: sin esto, un enlace a
 * `/error?desde=https://otra-web` convertía el botón «Recargar» en una
 * redirección a donde quisiera quien lo mandó. Tampoco vale volver a la propia
 * página de error.
 */
function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/';
  }
  return isErrorPage(raw) ? '/' : raw;
}
