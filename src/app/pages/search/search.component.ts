import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { BipsyService } from '../../services/bipsy.service';
import { BusinessResponse, CategoryResponse, ScheduleDayResponse } from '../../models/bipsy.models';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { ButtonComponent } from '../../components/button/button.component';
import { BusinessMapComponent, SearchArea } from '../../components/business-map/business-map.component';
import { GroupedSectionComponent } from '../../components/grouped-list/grouped-section.component';
import { GroupedRowComponent } from '../../components/grouped-list/grouped-row.component';
import { isGoogleMapsConfigured } from '../../../environments/maps.config';
import { DaySlot } from '../../components/search-bar/search-bar.component';
import { categoryIcon } from '../../shared/category-icons';
import { isoDate, longDate } from '../../shared/dates';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';

/**
 * Buscar. Port de la pestaña Explorar/Buscar de la app.
 *
 * Cinco filtros: texto, categoría, **zona** (punto y radio sobre el mapa),
 * **día** y cuatro interruptores. Los interruptores se aplican **aquí y no en la
 * API**: son datos que ya vienen en la respuesta, así que filtrar en el
 * navegador no reduce lo que se descarga y ahorra tres parámetros nuevos en el
 * backend. La lista y el mapa comparten esa función para que un negocio no
 * pueda salir en uno y no en el otro.
 */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BusinessCardComponent,
    ChipComponent,
    ButtonComponent,
    BusinessMapComponent,
    GroupedSectionComponent,
    GroupedRowComponent,
    DragScrollDirective,
  ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent implements OnInit, OnDestroy {
  private readonly bipsy = inject(BipsyService);
  private readonly catalog = inject(CatalogRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  searchQuery = '';
  selectedCategoryId?: number;
  categories: CategoryResponse[] = [];

  /** Lo que devuelve el servidor, sin los filtros locales aplicados. */
  private raw: BusinessResponse[] = [];

  isLoading = false;
  loadError: ApiError | null = null;

  // ----- FILTROS --------------------
  //
  // Todo lo que acota una búsqueda menos el texto y la categoría vive en una
  // sola hoja, como en la app: sueltos en la barra o se salían por la derecha,
  // o llenaban la cabecera de opciones antes de haber visto un resultado.
  filtersOpen = false;
  /** Qué está eligiendo dentro de la hoja: nada, el día o la zona. */
  picking: 'none' | 'date' = 'none';
  /** `yyyy-MM-dd`. Deja solo los que abren ese día de la semana. */
  date: string | null = null;
  area: SearchArea | null = null;
  /**
   * Franja del día pedida desde el buscador.
   *
   * El servidor no la conoce —`availableOn` filtra por día de la semana y el
   * listado no trae horarios—, así que se aplica aquí con el horario publicado
   * de cada resultado (`slotOpen`). Antes solo se enseñaba como chip y no
   * quitaba a nadie: un filtro que no filtra.
   */
  slot: DaySlot = 'any';

  /** Horario de cada negocio ya pedido, para no volver a pedirlo al cambiar de franja. */
  private readonly schedules = new Map<number, ScheduleDayResponse[] | null>();
  /** Negocios que atienden en la franja elegida, o null mientras se calcula. */
  private slotOpen: Set<number> | null = null;
  /** Se están trayendo horarios para aplicar la franja. */
  slotLoading = false;
  /** Texto de zona que Google no pudo resolver. Se manda como ciudad. */
  cityQuery: string | null = null;
  /** Nombre legible del punto elegido, para el chip de filtro activo. */
  areaLabel: string | null = null;
  atHomeOnly = false;
  /**
   * Solo los que aceptan reservas ya (`setupComplete`: horario y servicios),
   * como «Disponibles» en la app. Va en la URL (`disponibles=1`) para que el
   * enlace de una búsqueda lo conserve.
   */
  openNow = false;
  topRated = false;
  withPhoto = false;

  showMap = false;

  /** Sin clave de Google no se ofrece el mapa. */
  readonly mapAvailable = isGoogleMapsConfigured();

  /** El texto no dispara la búsqueda en cada tecla. */
  private debounce?: ReturnType<typeof setTimeout>;
  /** La última búsqueda lanzada: solo su respuesta se pinta. */
  private searchSeq = 0;

  async ngOnInit(): Promise<void> {
    try {
      this.categories = await this.bipsy.getCategories();
    } catch {
      // Sin categorías se puede seguir buscando por texto: el filtro es una
      // ayuda, no un requisito.
      this.categories = [];
    }

    // Todo el estado de la búsqueda entra por la URL: es lo que permite que el
    // header compacto la dispare, que el resultado se pueda enlazar y que
    // recargar la página no lo pierda.
    this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] ?? '';
      // El botón de filtros de Explorar entra por aquí: en la app abre la
      // hoja sin salir de la pantalla, y esta es la misma hoja.
      if (params['filtros']) {
        this.filtersOpen = true;
      }
      // El bloque del mapa de la portada entra directo a la vista de mapa.
      if (params['mapa']) {
        this.showMap = true;
      }
      this.date = params['date'] ?? null;
      this.slot = (params['slot'] as DaySlot) ?? 'any';
      this.cityQuery = params['city'] ?? null;
      this.areaLabel = params['place'] ?? null;
      this.openNow = params['disponibles'] === '1';

      const lat = Number(params['lat']);
      const lng = Number(params['lng']);
      this.area = Number.isFinite(lat) && Number.isFinite(lng) && params['lat'] != null
        ? { lat, lng, radiusKm: Number(params['radiusKm']) || 10 }
        : null;

      void this.doSearch();
    });
  }

  // ----- RESULTADOS --------------------

  /**
   * Los interruptores, aplicados en el navegador.
   *
   * `withPhoto` es propio de la web: en una rejilla de cinco columnas, los que
   * no han subido portada se distinguen de un vistazo y a veces se quieren
   * fuera.
   */
  get businesses(): BusinessResponse[] {
    let result = this.raw;
    if (this.atHomeOnly) {
      result = result.filter(b => b.worksAtHome);
    }
    if (this.openNow) {
      result = result.filter(b => b.setupComplete);
    }
    if (this.topRated) {
      result = result.filter(b => (b.averageRating ?? 0) >= 4);
    }
    if (this.withPhoto) {
      result = result.filter(b => !!b.coverImageUrl || !!b.profileImageUrl);
    }
    if (this.slot !== 'any' && this.slotOpen) {
      const open = this.slotOpen;
      result = result.filter(b => open.has(b.id));
    }
    return result;
  }

  /**
   * Calcula quién atiende en la franja: el día elegido o, sin día, cualquiera
   * de la semana. Mañana es lo que empieza antes de las 14:00; tarde, lo que
   * pisa de 14:00 a 20:00 —los mismos cortes que el paso de hora al reservar—.
   *
   * Un horario que no se ha podido traer NO descarta al negocio: es mejor que
   * sobre uno a que falte uno que sí abre.
   */
  private async applySlot(): Promise<void> {
    if (this.slot === 'any') {
      this.slotOpen = null;
      return;
    }
    this.slotLoading = true;
    const ids = this.raw.map(b => b.id).filter(id => !this.schedules.has(id));
    // De seis en seis: con cuarenta resultados, cuarenta peticiones a la vez
    // se notaban en el móvil.
    for (let i = 0; i < ids.length; i += 6) {
      await Promise.all(ids.slice(i, i + 6).map(async id => {
        try {
          this.schedules.set(id, await this.catalog.businessSchedule(id));
        } catch {
          this.schedules.set(id, null);
        }
      }));
    }
    const weekday = this.date ? WEEKDAYS[new Date(`${this.date}T12:00:00`).getDay()] : null;
    const open = new Set<number>();
    for (const b of this.raw) {
      const schedule = this.schedules.get(b.id);
      // Sin horario publicado se trata igual que sin poder traerlo: no se sabe
      // cuándo abre, y quitarlo escondería negocios que sí atienden.
      if (schedule == null || schedule.length === 0 || opensIn(schedule, this.slot, weekday)) {
        open.add(b.id);
      }
    }
    this.slotOpen = open;
    this.slotLoading = false;
  }

  get activeFilterCount(): number {
    return [
      this.date,
      this.area ?? this.cityQuery,
      this.slot === 'any' ? null : this.slot,
      this.atHomeOnly || null,
      this.openNow || null,
      this.topRated || null,
      this.withPhoto || null,
    ].filter(Boolean).length;
  }

  get dateLabel(): string | null {
    return this.date ? longDate(new Date(`${this.date}T12:00:00`)) : null;
  }

  /** Lo que dice la fila de la hoja cuando no hay nada elegido. */
  get dateRowValue(): string {
    return this.dateLabel ?? 'Cualquier día';
  }

  get zoneRowValue(): string {
    if (this.areaLabel) return this.areaLabel;
    if (this.cityQuery) return this.cityQuery;
    return this.area ? `A ${this.area.radiusKm} km del punto` : 'Cualquier zona';
  }

  /** Los próximos catorce días. Más allá, el filtro deja de ser útil. */
  get dateOptions(): { value: string; label: string }[] {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const day = new Date(today);
      day.setDate(today.getDate() + i);
      return { value: isoDate(day), label: longDate(day) };
    });
  }

  onQueryChange(): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.doSearch(), 300);
  }

  selectCategoryFilter(catId?: number): void {
    this.selectedCategoryId = this.selectedCategoryId === catId ? undefined : catId;
    void this.doSearch();
  }

  /** Quita la zona escrita a mano que no se pudo geocodificar. */
  /**
   * Las categorías como las pinta Android: barbería primero, que es la que más
   * negocios tiene. Sin «Todas»: en la app no existe esa tarjeta.
   */
  get tileCategories(): CategoryResponse[] {
    const isBarber = (code: string) => code === 'BARBER' || code === 'BARBERSHOP';
    return [...this.categories].sort((a, b) => Number(isBarber(b.code)) - Number(isBarber(a.code)));
  }

  /** Toca la ya elegida y se deselecciona, como en la app. */
  toggleCategoryFilter(cat: CategoryResponse): void {
    this.selectCategoryFilter(this.selectedCategoryId === cat.id ? undefined : cat.id);
  }

  clearCity(): void {
    this.cityQuery = null;
    void this.doSearch();
  }

  /**
   * Quita la franja del día. No relanza la búsqueda: el servidor no conoce la
   * franja, así que basta con dejar de filtrar lo que ya hay.
   */
  clearSlot(): void {
    this.slot = 'any';
    this.slotOpen = null;
  }

  onAreaChange(area: SearchArea | null): void {
    this.area = area;
    // La marcó en el mapa: el nombre que traía la URL ya no describe el punto.
    this.areaLabel = null;
    this.cityQuery = null;
    void this.doSearch();
  }

  setDate(value: string | null): void {
    this.date = this.date === value ? null : value;
    this.picking = 'none';
    void this.doSearch();
  }

  /** Dónde estaba el foco al abrir la hoja, para devolverlo al cerrarla. */
  private filtersReturnFocus: HTMLElement | null = null;

  /**
   * La hoja de filtros entra y sale del DOM con `filtersOpen`, y se abre desde
   * tres sitios (los dos botones y `?filtros=1`). Por eso el foco se mueve al
   * aparecer y desaparecer la hoja y no en cada botón.
   */
  @ViewChild('filterSheet') set filterSheet(ref: ElementRef<HTMLElement> | undefined) {
    if (ref && !this.filterSheetEl) {
      this.filtersReturnFocus = document.activeElement as HTMLElement | null;
      this.filterSheetEl = ref.nativeElement;
      // Fuera del ciclo de detección en curso: enfocar dentro dispara otro.
      setTimeout(() => this.filterSheetEl?.focus());
    } else if (!ref && this.filterSheetEl) {
      this.filterSheetEl = null;
      const back = this.filtersReturnFocus;
      this.filtersReturnFocus = null;
      setTimeout(() => back?.focus?.());
    }
  }
  private filterSheetEl: HTMLElement | null = null;

  closeFilters(): void {
    this.filtersOpen = false;
  }

  /** El tabulador da la vuelta dentro de la hoja en vez de salir a la página de detrás. */
  trapFocus(event: Event): void {
    const sheet = this.filterSheetEl;
    if (!sheet) return;
    const focusables = Array.from(
      sheet.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter(el => el.offsetParent !== null);
    if (focusables.length === 0) {
      event.preventDefault();
      sheet.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const back = (event as KeyboardEvent).shiftKey;
    const active = document.activeElement;
    if (back && (active === first || active === sheet)) {
      event.preventDefault();
      last.focus();
    } else if (!back && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** La zona se marca sobre el mapa, así que la hoja se aparta. */
  pickZone(): void {
    this.filtersOpen = false;
    this.showMap = true;
  }

  toggleSwitch(name: 'atHomeOnly' | 'openNow' | 'topRated' | 'withPhoto'): void {
    this[name] = !this[name];
    if (name === 'openNow') {
      this.syncOpenNowParam();
    }
  }

  /**
   * Escribe `disponibles` en la URL sin navegar: con `router.navigate` se
   * relanzaba la búsqueda entera para un filtro que se aplica aquí, sobre lo
   * que ya hay.
   */
  private syncOpenNowParam(): void {
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: { disponibles: this.openNow ? '1' : null },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  /**
   * «Ver todo» del estado vacío, `_showEverything` de la app: el filtro entero
   * en blanco, texto y categoría incluidos, no solo los de la hoja.
   */
  showEverything(): void {
    this.searchQuery = '';
    this.selectedCategoryId = undefined;
    this.clearFilters();
  }

  clearFilters(): void {
    this.date = null;
    this.area = null;
    this.atHomeOnly = false;
    if (this.openNow) {
      this.openNow = false;
      this.syncOpenNowParam();
    }
    this.topRated = false;
    this.withPhoto = false;
    this.slot = 'any';
    this.cityQuery = null;
    this.areaLabel = null;
    void this.doSearch();
  }

  async doSearch(): Promise<void> {
    // Cada búsqueda lleva su número: con el texto, la categoría y la URL
    // disparando búsquedas seguidas, una respuesta lenta de una búsqueda vieja
    // pisaba los resultados de la nueva.
    const seq = ++this.searchSeq;
    this.isLoading = true;
    this.loadError = null;
    try {
      // El punto se manda siempre que se sepa: con radio acota la búsqueda a
      // esa zona; sin él, solo sirve para que el servidor ordene por franjas
      // de distancia. **El orden lo decide siempre el servidor** y aquí no se
      // retoca.
      const raw = await this.bipsy.searchBusinesses({
        q: this.searchQuery.trim() || undefined,
        categoryId: this.selectedCategoryId,
        availableOn: this.date ?? undefined,
        city: this.cityQuery ?? undefined,
        lat: this.area?.lat,
        lng: this.area?.lng,
        radiusKm: this.area?.radiusKm,
      });
      if (seq !== this.searchSeq) return;
      this.raw = raw;
      await this.applySlot();
    } catch (error) {
      if (seq !== this.searchSeq) return;
      this.loadError = ApiError.from(error);
      this.raw = [];
    } finally {
      if (seq === this.searchSeq) {
        this.isLoading = false;
        this.slotLoading = false;
      }
    }
  }

  ngOnDestroy(): void {
    // Una tecla justo antes de salir lanzaría la búsqueda ya fuera de la página.
    clearTimeout(this.debounce);
    this.searchSeq++;
  }

  getCategoryIcon(code: string): string {
    return categoryIcon(code);
  }

  onRebook(business: BusinessResponse): void {
    const serviceId = business.discovery?.lastServiceId;
    if (!serviceId) {
      this.router.navigate(businessPath(business));
      return;
    }
    this.router.navigate(businessBookingPath(business), {
      queryParams: { serviceId, workerId: business.discovery?.lastWorkerId },
    });
  }
}

/** `Date.getDay()` → el nombre con el que el backend manda cada día. */
const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** «09:30:00» → 570. */
function minutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Si algún tramo del horario cae en la franja. `weekday` null = cualquier día.
 * Mañana: empieza antes de las 14:00. Tarde: pisa algo de 14:00 a 20:00.
 * Exportada para sus pruebas.
 */
export function opensIn(schedule: ScheduleDayResponse[], slot: DaySlot, weekday: string | null): boolean {
  return schedule.some(entry => {
    if (!entry.startTime || !entry.endTime) return false;
    if (weekday && entry.dayOfWeek !== weekday) return false;
    const start = minutes(entry.startTime);
    const end = minutes(entry.endTime);
    return slot === 'morning'
      ? start < 14 * 60
      : start < 20 * 60 && end > 14 * 60;
  });
}
