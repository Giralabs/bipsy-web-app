import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

const STORAGE_KEY = 'bipsy.devNotice.seen';

/**
 * «Web en desarrollo». Una pastilla abajo a la derecha que se despliega en una
 * tarjeta con la explicación.
 *
 * Flota en vez de ser una tira arriba: la web ya tiene la tira de Bipsy
 * Business y una barra pegajosa, y una tercera franja empujaba el contenido.
 * Abajo a la derecha porque el centro es de los avisos flotantes y la
 * izquierda, del indicador de mantenimiento.
 *
 * La primera visita la enseña abierta; cerrarla la deja en pastilla y eso se
 * recuerda en este navegador. La pastilla no se va: es un aviso, no publicidad.
 */
@Component({
  selector: 'app-dev-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dev-notice.component.html',
  styleUrl: './dev-notice.component.css',
})
export class DevNoticeComponent {
  readonly open = signal(!readSeen());

  toggle(): void {
    this.open.update(v => !v);
    if (!this.open()) markSeen();
  }

  close(): void {
    this.open.set(false);
    markSeen();
  }
}

function readSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* Sin almacenamiento: volverá a salir abierta la próxima vez, sin más. */
  }
}
