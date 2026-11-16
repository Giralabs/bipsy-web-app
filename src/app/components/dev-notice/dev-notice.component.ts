import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

const STORAGE_KEY = 'bipsy.devNotice.seen';

/** La tarjeta abierta. Fuera del componente para que el aviso de cookies la cierre. */
const cardOpen = signal(!readSeen());

/**
 * El aviso de cookies está en pantalla. En escritorio lleva dentro este mismo
 * aviso, así que la tarjeta se aparta: un solo aviso a la vez.
 */
export const cookieNoticeUp = signal(false);

/** Contestar a las cookies cuenta como haber visto el aviso. */
export function dismissDevCard(): void {
  cardOpen.set(false);
  markSeen();
}

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
  /** `float`: la pastilla del escritorio. `strip`: la franja fina del móvil. */
  @Input() variant: 'float' | 'strip' = 'float';

  readonly open = cardOpen;
  readonly cookieUp = cookieNoticeUp;

  toggle(): void {
    this.open.update(v => !v);
    if (!this.open()) markSeen();
  }

  close(): void {
    dismissDevCard();
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
