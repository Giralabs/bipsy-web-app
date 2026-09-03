import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { BipsyService } from '../../services/bipsy.service';
import { BusinessResponse, CategoryResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { ChipComponent } from '../../components/chip/chip.component';
import { ButtonComponent } from '../../components/button/button.component';
import { BusinessMapComponent, SearchArea } from '../../components/business-map/business-map.component';
import { GroupedSectionComponent } from '../../components/grouped-list/grouped-section.component';
import { GroupedRowComponent } from '../../components/grouped-list/grouped-row.component';
import { isGoogleMapsConfigured } from '../../../environments/maps.config';
import { DaySlot } from '../../components/search-header/search-header.component';
import { categoryIcon } from '../../shared/category-icons';
import { isoDate, longDate } from '../../shared/dates';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';

/**
 * Buscar. Port de la pestaña Explorar/Buscar de la app.
 *
 * Cinco filtros: texto, categoría, **zona** (punto y radio sobre el mapa),
 * **día** y tres interruptores. Los tres últimos se aplican **aquí y no en la
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
export class SearchComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
   * Franja del día pedida desde el header compacto.
   *
   * ⚠️ El servidor NO la conoce: `availableOn` filtra por día de la semana y la
   * respuesta del listado no trae horarios, así que aquí no se puede descartar
   * a nadie sin mentir. Se conserva para enseñarla como filtro activo y para
   * llevarla a la reserva, donde sí hay huecos reales que ordenar.
   */
  slot: DaySlot = 'any';
  /** Texto de zona que Google no pudo resolver. Se manda como ciudad. */
  cityQuery: string | null = null;
  /** Nombre legible del punto elegido, para el chip de filtro activo. */
  areaLabel: string | null = null;
  atHomeOnly = false;
  topRated = false;
  withPhoto = false;

  showMap = false;

  /** Sin clave de Google no se ofrece el mapa. */
  readonly mapAvailable = isGoogleMapsConfigured();

  /** El texto no dispara la búsqueda en cada tecla. */
  private debounce?: ReturnType<typeof setTimeout>;

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
      this.date = params['date'] ?? null;
      this.slot = (params['slot'] as DaySlot) ?? 'any';
      this.cityQuery = params['city'] ?? null;
      this.areaLabel = params['place'] ?? null;

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
   * Los tres interruptores, aplicados en el navegador.
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
    if (this.topRated) {
      result = result.filter(b => (b.averageRating ?? 0) >= 4);
    }
    if (this.withPhoto) {
      result = result.filter(b => !!b.coverImageUrl || !!b.profileImageUrl);
    }
    return result;
  }

  get activeFilterCount(): number {
    return [
      this.date,
      this.area ?? this.cityQuery,
      this.slot === 'any' ? null : this.slot,
      this.atHomeOnly || null,
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
   * Quita la franja del día.
   *
   * No relanza la búsqueda: el servidor no conoce la franja, así que los
   * resultados son exactamente los mismos. Una llamada de red para pintar un
   * chip menos sería gasto por nada.
   */
  clearSlot(): void {
    this.slot = 'any';
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

  /** La zona se marca sobre el mapa, así que la hoja se aparta. */
  pickZone(): void {
    this.filtersOpen = false;
    this.showMap = true;
  }

  toggleSwitch(name: 'atHomeOnly' | 'topRated' | 'withPhoto'): void {
    this[name] = !this[name];
  }

  clearFilters(): void {
    this.date = null;
    this.area = null;
    this.atHomeOnly = false;
    this.topRated = false;
    this.withPhoto = false;
    this.slot = 'any';
    this.cityQuery = null;
    this.areaLabel = null;
    void this.doSearch();
  }

  async doSearch(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    try {
      // El punto se manda siempre que se sepa: con radio acota la búsqueda a
      // esa zona; sin él, solo sirve para que el servidor ordene por franjas
      // de distancia. **El orden lo decide siempre el servidor** y aquí no se
      // retoca.
      this.raw = await this.bipsy.searchBusinesses({
        q: this.searchQuery.trim() || undefined,
        categoryId: this.selectedCategoryId,
        availableOn: this.date ?? undefined,
        city: this.cityQuery ?? undefined,
        lat: this.area?.lat,
        lng: this.area?.lng,
        radiusKm: this.area?.radiusKm,
      });
    } catch (error) {
      this.loadError = ApiError.from(error);
      this.raw = [];
    } finally {
      this.isLoading = false;
    }
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
