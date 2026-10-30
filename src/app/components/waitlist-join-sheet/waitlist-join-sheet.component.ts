import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../core/api-error';
import { BusinessResponse, ServiceResponse, WorkerResponse } from '../../models/bipsy.models';
import { WAITLIST_BANDS, WaitlistTimeBand } from '../../models/address-picker.models';
import { WaitlistRepository } from '../../repositories/waitlist.repository';
import { BipsyService } from '../../services/bipsy.service';
import { ButtonComponent } from '../button/button.component';
import { MonthCalendarComponent } from '../booking-steps/month-calendar.component';
import { isoDate } from '../../shared/dates';

/**
 * Cuánto se espera por defecto. Dos semanas es el horizonte con el que la
 * gente piensa una cita de belleza: «esta semana o la que viene».
 */
const DEFAULT_WAIT_DAYS = 14;

/** Tope del servidor para la nota (`@Size(max = 500)` en `JoinWaitlistRequest`). */
const NOTES_MAX = 500;

const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

type Picking = 'from' | 'to' | null;

/**
 * Apuntarse a la lista de espera de un servicio. Port de `showWaitlistJoinSheet`.
 *
 * Se abre desde el paso de hora cuando no hay ni un hueco. Es una hoja de
 * ajustes —la misma receta que la de filtros— porque lo que se pide son cuatro
 * preferencias, no un formulario.
 *
 * Todo viene con un valor por defecto que ya sirve: cualquier profesional,
 * desde hoy, dos semanas y cualquier hora. Apuntarse tiene que costar un clic
 * a quien le da igual el detalle, y quien quiera afinar puede.
 *
 * Los días se eligen con un calendario que se despliega DENTRO de la hoja, bajo
 * su fila, y no en otra hoja encima como en la app: aquí nunca hay dos hojas a
 * la vez, y desplegarlo deja ver a la vez el «Desde» y el «Hasta».
 */
@Component({
  selector: 'app-waitlist-join-sheet',
  standalone: true,
  imports: [FormsModule, ButtonComponent, MonthCalendarComponent],
  templateUrl: './waitlist-join-sheet.component.html',
  styleUrl: './waitlist-join-sheet.component.css',
})
export class WaitlistJoinSheetComponent implements OnInit, AfterViewInit {
  private readonly waitlist = inject(WaitlistRepository);
  private readonly bipsy = inject(BipsyService);

  @Input({ required: true }) business!: BusinessResponse;
  @Input({ required: true }) service!: ServiceResponse;
  /** El profesional elegido en el flujo, si lo hay. Undefined = cualquiera. */
  @Input() preferredWorkerId?: number;

  /** Se ha apuntado. La pantalla cierra la hoja y dice que está dentro. */
  @Output() joined = new EventEmitter<void>();
  /** Cerrada sin apuntarse: quien lo hace se queda donde estaba. */
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;

  readonly bands = WAITLIST_BANDS;
  readonly notesMax = NOTES_MAX;
  readonly today = startOfToday();
  /**
   * Hasta dónde llega el horizonte de reserva del negocio. Más allá el
   * servidor rechaza la espera, así que el calendario no lo ofrece.
   */
  maxDate = this.today;

  from = this.today;
  to = this.today;
  picking: Picking = null;

  workerId?: number;
  /** Los que prestan este servicio. Vacío = no se pregunta «Con quién». */
  workers: WorkerResponse[] = [];

  readonly selectedBands = new Set<WaitlistTimeBand>();
  notes = '';

  sending = false;
  error: string | null = null;

  /** El foco vuelve a donde estaba al cerrar. */
  private readonly returnFocus = document.activeElement as HTMLElement | null;

  ngOnInit(): void {
    const horizon = this.business.availabilityHorizonDays || 30;
    this.maxDate = addDays(this.today, horizon);
    this.to = this.cap(addDays(this.today, DEFAULT_WAIT_DAYS));
    this.workerId = this.preferredWorkerId;
    void this.loadWorkers();
  }

  ngAfterViewInit(): void {
    this.panel?.nativeElement.focus();
  }

  // ----- VISTA --------------------

  get fromLabel(): string {
    return this.dayLabel(this.from);
  }

  get toLabel(): string {
    return this.dayLabel(this.to);
  }

  isBandOn(band: WaitlistTimeBand): boolean {
    return this.selectedBands.has(band);
  }

  // ----- ACCIONES --------------------

  /**
   * Escape pliega primero el calendario abierto, y con todo plegado cierra la
   * hoja: es lo que se espera de una capa encima de otra.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (event.defaultPrevented) {
      return;
    }
    if (this.picking) {
      this.picking = null;
      return;
    }
    this.close();
  }

  close(): void {
    if (this.sending) {
      return;
    }
    this.closed.emit();
    this.returnFocus?.focus?.();
  }

  /** Abre el calendario de esa fila, o lo pliega si ya estaba abierto. */
  togglePicker(which: Exclude<Picking, null>): void {
    this.picking = this.picking === which ? null : which;
  }

  pickFrom(day: Date): void {
    this.from = day;
    // Mover el inicio por detrás del final dejaría una ventana imposible, y el
    // servidor la rechazaría con un error que el cliente no ha provocado.
    if (this.to < this.from) {
      this.to = day;
    }
    this.picking = null;
  }

  pickTo(day: Date): void {
    this.to = day;
    this.picking = null;
  }

  toggleBand(band: WaitlistTimeBand): void {
    if (!this.selectedBands.delete(band)) {
      this.selectedBands.add(band);
    }
  }

  chooseWorker(id?: number): void {
    this.workerId = id;
  }

  async submit(): Promise<void> {
    if (this.sending) {
      return;
    }
    this.sending = true;
    this.error = null;
    const notes = this.notes.trim();
    try {
      await this.waitlist.join({
        serviceId: this.service.id,
        workerId: this.workerId,
        dateFrom: isoDate(this.from),
        dateTo: isoDate(this.to),
        timeBands: [...this.selectedBands],
        notes: notes || undefined,
      });
      this.joined.emit();
    } catch (raw) {
      // El servidor manda motivos que el cliente entiende —ya estás en esta
      // lista, has llegado a tu tope de citas—, así que se enseña el suyo en
      // vez de un «algo ha ido mal» que no dice qué hacer.
      const error = ApiError.from(raw);
      this.error = error.networkError
        ? 'Sin conexión. Comprueba tu red.'
        : error.message?.trim() || 'No se ha podido completar. Inténtalo de nuevo.';
      this.sending = false;
    }
  }

  // ----- INTERNO --------------------

  /**
   * Con quién. Solo si hay equipo de verdad: en un negocio de una persona la
   * pregunta no tiene sentido. Si la lista no carga, se apunta con «cualquiera»,
   * que es lo que más huecos casa.
   */
  private async loadWorkers(): Promise<void> {
    const ids = this.service.workerIds ?? [];
    if (ids.length <= 1) {
      return;
    }
    try {
      const all = await this.bipsy.getBusinessWorkers(this.business.id);
      const eligible = all.filter(w => ids.includes(w.id));
      this.workers = eligible.length > 1 ? eligible : [];
    } catch {
      this.workers = [];
    }
  }

  private cap(d: Date): Date {
    return d > this.maxDate ? this.maxDate : d;
  }

  private dayLabel(day: Date): string {
    const diff = Math.round((day.getTime() - this.today.getTime()) / 86_400_000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return DAY_MONTH.format(day);
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
