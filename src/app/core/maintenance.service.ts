import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiError } from './api-error';
import { MaintenanceRepository } from '../repositories/maintenance.repository';

/** Lo último que se sabe del interruptor. */
interface MaintenanceState {
  maintenance: boolean;
  /** Hay mantenimiento, pero esta persona lleva un pase que vale. */
  bypass: boolean;
  message: string | null;
}

/**
 * La web cerrada al público, que es como se arranca y a lo que se vuelve ante
 * la duda: mientras el backend solo corra en las máquinas del equipo, que nadie
 * conteste significa que quien mira no es del equipo.
 */
const CLOSED: MaintenanceState = { maintenance: true, bypass: false, message: null };

/** Cada cuánto se vuelve a preguntar mientras la pestaña está a la vista. */
const RECHECK_MS = 60_000;

/**
 * Si la web está en mantenimiento, y si esta persona puede pasar igualmente.
 *
 * Es el único sitio que lo decide; la raíz solo lo lee para pintar la web o la
 * pantalla de mantenimiento.
 *
 * **No bloquea el arranque.** La pregunta sale al construirse y la web se
 * pinta sin esperarla: el servidor puede estar dormido —medio minuto en el
 * plan gratuito de Render— y nadie debería mirar una pantalla en blanco por un
 * interruptor que casi siempre está apagado.
 *
 * **Ante la duda, cerrada.** La web está en mantenimiento hasta que el
 * servidor diga lo contrario, y siempre que no se le pueda preguntar. El
 * backend todavía no está alojado —corre en las máquinas del equipo—, así que
 * para el público no hay a quién preguntar y solo ve la pantalla de
 * mantenimiento; el equipo, con el backend arrancado, recibe la respuesta de
 * verdad y entra por /admin con la contraseña. Si el servidor YA contestó en
 * esta visita, un fallo de red posterior no cambia lo que dijo.
 *
 * **La última respuesta se recuerda** en `localStorage` para arrancar desde
 * ella: sin eso, recargar en pleno mantenimiento enseñaba la web un instante
 * antes de taparla. Lo que diga el servidor siempre manda sobre lo guardado.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private static readonly STATE = 'bipsy_maintenance_state';
  private static readonly TOKEN = 'bipsy_maintenance_token';

  private readonly repo = inject(MaintenanceRepository);

  /**
   * El pase, también en memoria: con el almacenamiento bloqueado (navegación
   * privada) no habría dónde guardarlo y el equipo se quedaría fuera en la
   * siguiente comprobación, un minuto después de haber entrado.
   */
  private memoryToken: string | null = null;

  private readonly state = signal<MaintenanceState>(this.readCached());

  /** El interruptor está puesto, deje o no pasar a esta persona. */
  readonly maintenance = computed(() => this.state().maintenance);
  /** Está puesto y esta persona está dentro como equipo. */
  readonly bypass = computed(() => this.state().maintenance && this.state().bypass);
  /** Está puesto y esta persona NO pasa: toca la pantalla de mantenimiento. */
  readonly blocked = computed(() => this.state().maintenance && !this.state().bypass);
  readonly message = computed(() => this.state().message);

  /** El servidor ha contestado al menos una vez en esta visita. */
  private confirmed = false;

  /**
   * Sube cada vez que el pase cambia. Una respuesta que salió con el pase
   * anterior ya no vale: sin esto, una comprobación en vuelo al desbloquear
   * volvía con `bypass: false` y tiraba el pase recién estrenado.
   */
  private generation = 0;

  /** La comprobación en marcha, para no lanzar dos a la vez. */
  private inFlight: Promise<void> | null = null;

  constructor() {
    void this.check();

    if (typeof document === 'undefined') {
      return;
    }
    // Con la pestaña escondida no se pregunta: nadie la está mirando, y al
    // volver a ella se comprueba en el acto.
    setInterval(() => {
      if (!document.hidden) {
        void this.check();
      }
    }, RECHECK_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        void this.check();
      }
    });
  }

  /**
   * Pregunta al servidor y aplica lo que diga. Nunca falla: quien la espera
   * solo quiere saber cuándo ha terminado.
   */
  check(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    const run = this.ask().finally(() => {
      if (this.inFlight === run) {
        this.inFlight = null;
      }
    });
    this.inFlight = run;
    return run;
  }

  /**
   * Cambia la contraseña del equipo por un pase y deja entrar.
   *
   * Los fallos suben tal cual —401, 429, 404, sin red— para que la pantalla
   * diga cada uno con sus palabras.
   */
  async unlock(password: string): Promise<void> {
    const pass = await this.repo.unlock(password);
    this.invalidate();
    this.memoryToken = pass.token;
    this.write(MaintenanceService.TOKEN, pass.token);
    this.confirmed = true;
    this.apply({ maintenance: true, bypass: true, message: this.state().message });
  }

  /** Olvida el pase: la web se vuelve a ver como la ve el público. */
  leave(): void {
    this.invalidate();
    this.forgetToken();
    this.apply({ ...this.state(), bypass: false });
    void this.check();
  }

  private async ask(): Promise<void> {
    const generation = this.generation;
    const token = this.token;
    try {
      const res = await this.repo.status(token);
      if (generation !== this.generation) {
        return;
      }
      this.confirmed = true;
      const maintenance = res.maintenance === true;
      const bypass = maintenance && res.bypass === true;
      // El servidor ya no lo acepta —caducó, o el mantenimiento terminó—: un
      // pase que no abre nada es un pase que sobra.
      if (token && !bypass) {
        this.forgetToken();
      }
      this.apply({ maintenance, bypass, message: res.message?.trim() || null });
    } catch (raw) {
      if (generation !== this.generation) {
        return;
      }
      const error = ApiError.from(raw);
      if (this.confirmed && !error.isNotFound) {
        return;
      }
      // Sin respuesta que valga, cerrada: se conserva el mensaje que hubiera.
      this.state.set({ ...CLOSED, message: this.state().message });
    }
  }

  private invalidate(): void {
    this.generation++;
    this.inFlight = null;
  }

  private apply(next: MaintenanceState): void {
    this.state.set(next);
    // Solo se guarda mientras hay mantenimiento. El resto del tiempo —casi
    // siempre— no queda nada escrito.
    if (next.maintenance) {
      this.write(MaintenanceService.STATE, JSON.stringify(next));
    } else {
      this.remove(MaintenanceService.STATE);
    }
  }

  private get token(): string | null {
    return this.read(MaintenanceService.TOKEN) ?? this.memoryToken;
  }

  private forgetToken(): void {
    this.memoryToken = null;
    this.remove(MaintenanceService.TOKEN);
  }

  /** De dónde se arranca: lo último que contestó el servidor, si lo hay. */
  private readCached(): MaintenanceState {
    try {
      const raw = this.read(MaintenanceService.STATE);
      const saved = raw ? (JSON.parse(raw) as Partial<MaintenanceState> | null) : null;
      if (saved?.maintenance !== true) {
        return CLOSED;
      }
      return {
        maintenance: true,
        // Sin pase guardado no hay "dentro como equipo" que recordar.
        bypass: saved.bypass === true && !!this.read(MaintenanceService.TOKEN),
        message: typeof saved.message === 'string' ? saved.message : null,
      };
    } catch {
      // Lo guardado no es JSON: alguien lo ha tocado. Como si no hubiera nada.
      return CLOSED;
    }
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
      // Navegación privada con almacenamiento bloqueado: se pierde el recuerdo
      // entre recargas, no el funcionamiento.
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nada que borrar y nada que avisar.
    }
  }
}
