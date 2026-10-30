import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { timeLeftLabel } from '../../models/confirm.models';

/**
 * El recuadro que dice cuánto queda de un plazo. Port de `GipsiCountdown`.
 *
 * Lo comparten dos pantallas —la cita que te pone el negocio y el aviso de
 * hueco libre— por lo mismo que en la app: dos cronómetros escritos aparte
 * acaban contando distinto.
 *
 * Se refresca **cada segundo por debajo de un minuto y cada treinta por
 * encima**: al segundo durante horas solo gasta, y al minuto en los últimos
 * treinta segundos se queda clavado justo cuando importa.
 *
 * Sin `aria-live`: anunciar el plazo cada vez que cambia sería una
 * interrupción constante para quien usa lector de pantalla. `role="timer"` ya
 * dice lo que es, y el texto se lee cuando se llega a él.
 */
@Component({
  selector: 'app-deadline-countdown',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cd" [class.cd--urgent]="urgent" role="timer">
      <p class="cd__title">{{ title }}</p>
      <p class="cd__label">{{ label }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Menta tenue mientras hay tiempo y rojo tenue cuando aprieta: el color es
       el aviso, así que no puede estar puesto siempre. */
    .cd {
      padding: 16px 18px;
      border-radius: var(--r-md);
      background: var(--clr-mint-dim);
    }

    .cd__title {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--clr-mint);
    }

    /* Cifras de ancho fijo: que el texto no baile al cambiar de número. */
    .cd__label {
      margin-top: 2px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--clr-text-2);
      font-variant-numeric: tabular-nums;
    }

    .cd--urgent { background: rgba(230, 118, 118, .14); }
    .cd--urgent .cd__title { color: var(--clr-danger-text); }
  `],
})
export class DeadlineCountdownComponent implements OnChanges, OnDestroy {
  /** Cuándo se acaba. Instante con zona (UTC), tal y como lo manda el servidor. */
  @Input({ required: true }) expiresAt!: string;
  @Input({ required: true }) title!: string;
  /** Lo que va delante de la cifra: «Te quedan». */
  @Input() before = 'Te quedan';
  /** Lo que va detrás: «para decidir», «para confirmarla». */
  @Input() after = '';
  @Input() expiredLabel = 'Se ha pasado el plazo';
  /**
   * Por debajo de esto se pinta en rojo, en milisegundos.
   *
   * Configurable porque no significa lo mismo en los dos sitios: un aviso de
   * hueco dura horas y una hora restante ya aprieta, pero una cita por
   * confirmar dura diez minutos y con ese umbral saldría roja desde el
   * principio.
   */
  @Input() urgentUnderMs = 3_600_000;

  /** Se emite UNA vez, al llegar a cero. Quien lo recibe recarga. */
  @Output() expired = new EventEmitter<void>();

  leftMs = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private fired = false;

  ngOnChanges(): void {
    this.fired = false;
    this.tick();
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  get urgent(): boolean {
    return this.leftMs < this.urgentUnderMs;
  }

  get label(): string {
    if (this.leftMs <= 0) {
      return this.expiredLabel;
    }
    return [this.before, timeLeftLabel(this.leftMs), this.after].filter(Boolean).join(' ');
  }

  /**
   * Un `setTimeout` que se vuelve a programar en cada vuelta, en vez de un
   * intervalo fijo: así el paso cambia solo al cruzar el último minuto.
   */
  private tick(): void {
    clearTimeout(this.timer);
    const wasRunning = this.leftMs > 0;
    this.leftMs = new Date(this.expiresAt).getTime() - Date.now();
    if (this.leftMs <= 0) {
      // Solo se avisa si se ha visto correr el plazo. Si ya llegó vencido, la
      // pantalla lo sabe al cargar; avisar entonces la haría recargar en bucle
      // mientras el servidor no cierre la cita. Y fuera del ciclo de detección
      // de cambios: quien lo recibe cambia su estado.
      if (wasRunning && !this.fired) {
        this.fired = true;
        setTimeout(() => this.expired.emit());
      }
      return;
    }
    const step = this.leftMs < 60_000 ? 1_000 : 30_000;
    this.timer = setTimeout(() => this.tick(), step);
  }
}
