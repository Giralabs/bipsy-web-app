import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageMetaService } from '../../core/page-meta.service';
import { ButtonComponent } from '../../components/button/button.component';
import { StatusPageComponent } from '../../components/status-page/status-page.component';

/** Qué invitación es: la ruta lo dice en `data.kind`. */
export type InviteKind = 'team' | 'customer';

/** Cuánto se queda el «Copiado» en el botón antes de volver a «Copiar». */
const COPIED_FEEDBACK_MS = 2000;

/**
 * `/equipo/:codigo` y `/invitacion/:codigo`: lo que ve quien abre una
 * invitación SIN la app instalada.
 *
 * Con la app, el sistema ni siquiera carga esta página: el enlace abre la app
 * (el reparto de rutas está en `.well-known/apple-app-site-association`). Por
 * eso aquí solo hace falta lo que le sirve a quien aún no la tiene: dónde
 * bajársela y el código bien visible para copiarlo, porque tras instalar el
 * enlace ya no vuelve a entrar —eso exigiría un servicio de enlaces diferidos—
 * y el código se escribe a mano.
 *
 * No pide nada a la API: se sirve también en mantenimiento.
 */
@Component({
  selector: 'app-invite',
  standalone: true,
  imports: [StatusPageComponent, ButtonComponent],
  templateUrl: './invite.component.html',
  styleUrl: './invite.component.css',
})
export class InviteComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly kind: InviteKind = this.route.snapshot.data['kind'] === 'team' ? 'team' : 'customer';
  readonly code = (this.route.snapshot.paramMap.get('codigo') ?? '').trim();
  readonly copied = signal(false);

  private readonly releaseMeta = inject(PageMetaService).set(
    this.kind === 'team' ? 'Invitación a un equipo' : 'Invitación a Bipsy',
    // Un código de invitación no es algo que deba salir en un buscador.
    true,
  );
  private copiedTimer?: ReturnType<typeof setTimeout>;

  get heading(): string {
    return this.kind === 'team' ? 'Te han invitado a un equipo' : 'Te han invitado a Bipsy';
  }

  get lead(): string {
    return this.kind === 'team'
      ? 'Descarga Bipsy para negocios, elige «Soy trabajador» al crear tu cuenta y escribe este código.'
      : 'Descarga Bipsy y escribe este código al crear tu cuenta: así cuentas como invitado de quien te lo ha mandado.';
  }

  /** `/descargar` ya decide la tienda; aquí solo se dice qué app. */
  get downloadLink(): string[] {
    return this.kind === 'team' ? ['/descargar', 'negocio'] : ['/descargar'];
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
    } catch (error) {
      // Sin permiso de portapapeles (algún navegador embebido lo niega) el
      // código sigue a la vista y seleccionable: se copia a mano.
      console.warn('No se pudo copiar el código de invitación', error);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
    this.releaseMeta();
  }
}
