import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session.service';
import {
  ResolvedPlace,
  describeCoordinates,
  geocodeAddress,
  isGoogleMapsConfigured,
} from '../../core/google-maps-loader';

/** Franja del día. El backend no la conoce: viaja con la búsqueda. */
export type DaySlot = 'morning' | 'afternoon' | 'any';

/**
 * Radio por defecto al elegir un sitio.
 *
 * 25 y no los 5 que trae el mapa: quien escribe «Marchena» en la barra no ha
 * marcado un punto en un plano, ha dicho una zona. Con 10 km una búsqueda desde
 * un pueblo devolvía cero teniendo negocios a veinte minutos. Se puede afinar
 * después desde el mapa de Buscar.
 */
const DEFAULT_RADIUS_KM = 25;

/** A partir de aquí el header compacto sustituye al normal. */
const REVEAL_AT_PX = 180;

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Header compacto que aparece al bajar.
 *
 * **No sustituye al header normal, lo tapa.** Va `fixed` con un z-index por
 * encima de la barra `sticky`, y entra deslizándose cuando se ha bajado de
 * {@link REVEAL_AT_PX}. Arriba del todo no se pinta y la cabecera de siempre
 * queda intacta, que es la condición que se puso.
 *
 * Los tres campos son los de la app: qué, dónde y cuándo. «Cuándo» pide un día
 * y una franja —mañana o tarde— en vez de una hora concreta, porque a la hora
 * de buscar todavía no se sabe qué servicio se va a pedir ni cuánto dura.
 */
@Component({
  selector: 'app-search-header',
  standalone: true,
  // Sin FormsModule a proposito: este componente va en el armazon y se carga
  // siempre, y ngModel metia 53 kB en el bundle inicial para dos <input>. Los
  // dos campos se atan a mano con [value] + (input).
  imports: [CommonModule, RouterLink],
  templateUrl: './search-header.component.html',
  styleUrl: './search-header.component.css',
})
export class SearchHeaderComponent implements OnInit {
  private readonly router = inject(Router);
  readonly session = inject(SessionService);

  visible = false;

  /** Qué panel está abierto. Solo uno a la vez. */
  open: 'none' | 'where' | 'when' = 'none';

  // ----- QUÉ --------------------
  service = '';

  // ----- DÓNDE --------------------
  place: ResolvedPlace | null = null;
  /** Lo que se escribió cuando Google no pudo resolverlo. Se manda como texto. */
  placeText = '';
  placeQuery = '';
  placeResults: ResolvedPlace[] = [];
  placeBusy = false;
  placeError: string | null = null;
  readonly mapsAvailable = isGoogleMapsConfigured();

  // ----- CUÁNDO --------------------
  /** `yyyy-MM-dd`, o null para «cualquier día». */
  date: string | null = null;
  slot: DaySlot = 'any';
  /** Mes que se está enseñando en el calendario. Día 1 a mediodía. */
  monthCursor = startOfMonth(new Date());

  ngOnInit(): void {
    this.onScroll();
  }

  // ----- VISIBILIDAD --------------------

  @HostListener('window:scroll')
  onScroll(): void {
    const next = window.scrollY > REVEAL_AT_PX;
    if (next === this.visible) {
      return;
    }
    this.visible = next;
    // Al desaparecer no puede quedarse un panel abierto flotando sobre la
    // página: el header se va y el desplegable se quedaría huérfano.
    if (!next) {
      this.open = 'none';
    }
  }

  /** Cerrar al pulsar fuera. El clic dentro no burbujea hasta aquí. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open === 'none') {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('.sheader')) {
      this.open = 'none';
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = 'none';
  }

  toggle(panel: 'where' | 'when'): void {
    this.open = this.open === panel ? 'none' : panel;
    if (panel === 'when' && this.date) {
      this.monthCursor = startOfMonth(new Date(`${this.date}T12:00:00`));
    }
  }

  // ----- DÓNDE --------------------

  get placeLabel(): string {
    if (this.place) return shorten(this.place.label);
    if (this.placeText) return this.placeText;
    return 'En cualquier sitio';
  }

  /**
   * Pide la ubicación del navegador.
   *
   * El diálogo del permiso lo abre el propio `getCurrentPosition`; no hay forma
   * de preguntar antes sin provocarlo, así que el botón es literalmente eso.
   */
  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.placeError = 'Tu navegador no permite compartir la ubicación.';
      return;
    }
    this.placeBusy = true;
    this.placeError = null;
    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        const label = await describeCoordinates(latitude, longitude);
        this.place = { label: label ?? 'Cerca de mí', lat: latitude, lng: longitude };
        this.placeText = '';
        this.placeResults = [];
        this.placeBusy = false;
        this.open = 'none';
        this.submit();
      },
      error => {
        this.placeBusy = false;
        this.placeError = error.code === error.PERMISSION_DENIED
          ? 'Has denegado el acceso a la ubicación. Escribe una dirección debajo.'
          : 'No hemos podido obtener tu ubicación. Escribe una dirección debajo.';
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  /**
   * Resuelve lo escrito con Google Maps.
   *
   * Si Google no está disponible —sin clave, clave rechazada, API sin
   * habilitar— **no se bloquea la búsqueda**: el texto se manda tal cual y el
   * servidor filtra por ciudad, que es lo que ya hacía la web antes del mapa.
   */
  async resolvePlace(): Promise<void> {
    const query = this.placeQuery.trim();
    if (!query) {
      return;
    }
    if (!this.mapsAvailable) {
      this.useAsPlainText(query);
      return;
    }

    this.placeBusy = true;
    this.placeError = null;
    try {
      this.placeResults = await geocodeAddress(query);
      if (!this.placeResults.length) {
        this.placeError = 'No hemos encontrado ese sitio. Se buscará por el texto tal cual.';
      }
    } catch {
      this.useAsPlainText(query);
    } finally {
      this.placeBusy = false;
    }
  }

  choosePlace(result: ResolvedPlace): void {
    this.place = result;
    this.placeText = '';
    this.placeResults = [];
    this.placeQuery = '';
    this.open = 'none';
    this.submit();
  }

  clearPlace(): void {
    this.place = null;
    this.placeText = '';
    this.placeQuery = '';
    this.placeResults = [];
    this.placeError = null;
  }

  private useAsPlainText(query: string): void {
    this.place = null;
    this.placeText = query;
    this.placeResults = [];
    this.open = 'none';
    this.submit();
  }

  // ----- CUÁNDO --------------------

  get whenLabel(): string {
    const day = this.date ? shortDate(new Date(`${this.date}T12:00:00`)) : null;
    const band = this.slot === 'morning' ? 'mañana' : this.slot === 'afternoon' ? 'tarde' : null;
    if (day && band) return `${day}, ${band}`;
    if (day) return day;
    if (band) return `Por la ${band}`;
    return 'Cualquier día';
  }

  get monthLabel(): string {
    // Se capitaliza aqui y no con CSS: `text-transform: capitalize` tambien
    // pone en mayuscula el "de" y sale "Septiembre De 2026".
    const month = MONTHS[this.monthCursor.getMonth()];
    return `${month[0].toUpperCase()}${month.slice(1)} de ${this.monthCursor.getFullYear()}`;
  }

  /** True cuando el mes que se ve es el actual: no se puede retroceder más. */
  get atFirstMonth(): boolean {
    const now = startOfMonth(new Date());
    return this.monthCursor.getTime() <= now.getTime();
  }

  /**
   * Las celdas del mes, con los huecos delante para que el día 1 caiga en su
   * columna. La semana empieza en lunes, como en España.
   */
  get monthCells(): (CalendarDay | null)[] {
    const year = this.monthCursor.getFullYear();
    const month = this.monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: (CalendarDay | null)[] = Array(lead).fill(null);
    for (let day = 1; day <= total; day++) {
      const value = new Date(year, month, day);
      cells.push({
        day,
        iso: isoDate(value),
        past: value.getTime() < today.getTime(),
      });
    }
    return cells;
  }

  shiftMonth(delta: number): void {
    const next = new Date(this.monthCursor);
    next.setMonth(next.getMonth() + delta);
    if (delta < 0 && next.getTime() < startOfMonth(new Date()).getTime()) {
      return;
    }
    this.monthCursor = next;
  }

  chooseDay(cell: CalendarDay): void {
    if (cell.past) return;
    this.date = this.date === cell.iso ? null : cell.iso;
  }

  chooseSlot(slot: DaySlot): void {
    this.slot = slot;
  }

  clearWhen(): void {
    this.date = null;
    this.slot = 'any';
  }

  applyWhen(): void {
    this.open = 'none';
    this.submit();
  }

  // ----- BUSCAR --------------------

  /**
   * Navega a Buscar con lo que haya puesto.
   *
   * Todo va en la URL y no en un servicio compartido: así el resultado se puede
   * enlazar, recargar y compartir, y la página de Buscar sigue siendo la única
   * dueña de su estado.
   */
  submit(): void {
    const params: Record<string, string | number> = {};
    const text = this.service.trim();
    if (text) params['q'] = text;
    if (this.place) {
      params['lat'] = this.place.lat;
      params['lng'] = this.place.lng;
      params['radiusKm'] = DEFAULT_RADIUS_KM;
      params['place'] = this.place.label;
    } else if (this.placeText) {
      params['city'] = this.placeText;
    }
    if (this.date) params['date'] = this.date;
    if (this.slot !== 'any') params['slot'] = this.slot;

    void this.router.navigate(['/search'], { queryParams: params });
  }

  trackCell(index: number): number {
    return index;
  }
}

interface CalendarDay {
  day: number;
  iso: string;
  past: boolean;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1, 12);
}

function isoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function shortDate(value: Date): string {
  return value.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** La dirección completa de Google no cabe en el campo: se queda con lo útil. */
function shorten(label: string): string {
  const parts = label.split(',').map(part => part.trim()).filter(Boolean);
  return parts.slice(0, 2).join(', ') || label;
}
