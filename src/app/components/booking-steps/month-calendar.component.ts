import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import { capitalize, longDate } from '../../shared/dates';

/** Una casilla del mes. Null es un hueco antes del día 1 o después del último. */
interface Cell {
  date: Date;
  key: number;
  enabled: boolean;
  today: boolean;
}

const MONTH = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

/**
 * Calendario de un mes, con el lunes primero. Port del `TableCalendar` del paso
 * de fecha de la app.
 *
 * Solo se pueden elegir días entre `first` y `last` —hoy y el horizonte del
 * negocio—; el resto se ven, apagados, para que el mes no tenga agujeros.
 *
 * Los días son botones de verdad: se llega con el tabulador y se elige con
 * Intro. Las flechas mueven el foco de día en día (y de mes, si hace falta),
 * que es lo que se espera de una rejilla de fechas.
 */
@Component({
  selector: 'app-month-calendar',
  standalone: true,
  templateUrl: './month-calendar.component.html',
  styleUrl: './month-calendar.component.css',
})
export class MonthCalendarComponent implements OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) first!: Date;
  @Input({ required: true }) last!: Date;
  @Input() selected?: Date | null;

  @Output() selectedChange = new EventEmitter<Date>();

  /** Como `TableCalendar` en español (`DateFormat.E`): abreviados, sin punto. */
  readonly weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  readonly weekdayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  /** El primer día del mes que se enseña. */
  month = startOfMonth(new Date());
  cells: (Cell | null)[] = [];

  private shownOnce = false;

  ngOnChanges(): void {
    // El mes de partida es el del día elegido, o el de hoy. Solo la primera
    // vez: si no, cada cambio de selección devolvería al cliente a ese mes
    // mientras está mirando otro.
    if (!this.shownOnce && this.first) {
      this.month = startOfMonth(this.selected ?? this.first);
      this.shownOnce = true;
    }
    this.build();
  }

  get title(): string {
    return capitalize(MONTH.format(this.month));
  }

  get canPrev(): boolean {
    return this.month.getTime() > startOfMonth(this.first).getTime();
  }

  get canNext(): boolean {
    return this.month.getTime() < startOfMonth(this.last).getTime();
  }

  prev(): void {
    if (this.canPrev) {
      this.month = addMonths(this.month, -1);
      this.build();
    }
  }

  next(): void {
    if (this.canNext) {
      this.month = addMonths(this.month, 1);
      this.build();
    }
  }

  isSelected(cell: Cell): boolean {
    return !!this.selected && sameDay(cell.date, this.selected);
  }

  label(cell: Cell): string {
    const text = longDate(cell.date);
    return cell.today ? `Hoy, ${text}` : text;
  }

  /**
   * Qué día recibe el tabulador dentro del mes. Solo uno —el elegido, o el
   * primero que se puede elegir—: con 30 paradas para cruzar el calendario,
   * llegar al botón de «Siguiente» costaba medio minuto de teclado. Dentro
   * del mes se va con las flechas.
   */
  tabIndex(cell: Cell): number {
    const anchor = this.focusAnchor();
    return anchor !== null && cell.key === anchor ? 0 : -1;
  }

  pick(cell: Cell): void {
    if (cell.enabled) {
      this.selectedChange.emit(cell.date);
    }
  }

  /** Flechas: un día a los lados, una semana arriba y abajo. */
  onKey(event: KeyboardEvent, cell: Cell): void {
    const delta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = delta[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const target = new Date(cell.date);
    target.setDate(target.getDate() + step);
    if (target < startOfDay(this.first) || target > startOfDay(this.last)) {
      return;
    }
    if (target.getMonth() !== this.month.getMonth()) {
      this.month = startOfMonth(target);
      this.build();
    }
    // Después de pintar: el botón del mes nuevo todavía no existe.
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>(`[data-key="${target.getTime()}"]`);
      el?.focus();
    });
  }

  private focusAnchor(): number | null {
    const enabled = this.cells.filter((c): c is Cell => !!c && c.enabled);
    const chosen = enabled.find(c => this.isSelected(c));
    return (chosen ?? enabled[0])?.key ?? null;
  }

  private build(): void {
    if (!this.first || !this.last) {
      return;
    }
    const from = startOfDay(this.first).getTime();
    const to = startOfDay(this.last).getTime();
    const today = startOfDay(new Date()).getTime();

    const year = this.month.getFullYear();
    const month = this.month.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // getDay() da el domingo como 0; con el lunes primero va al final.
    const lead = (new Date(year, month, 1).getDay() + 6) % 7;

    const cells: (Cell | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = date.getTime();
      cells.push({ date, key, enabled: key >= from && key <= to, today: key === today });
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    this.cells = cells;
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
