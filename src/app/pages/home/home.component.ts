import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { distinctUntilChanged, skip } from 'rxjs';
import { BipsyService } from '../../services/bipsy.service';
import { ApiError } from '../../core/api-error';
import {
  BookingResponse,
  BusinessResponse,
  CategoryResponse,
  ReviewResponse,
  isBookingActive,
  primaryCategory,
  reviewAuthor,
} from '../../models/bipsy.models';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { capitalize, isoDate, longDate, parseLocal, relativeDate } from '../../shared/dates';
import { categoryIcon } from '../../shared/category-icons';
import { fixImageUrl } from '../../shared/image-url';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { BusinessRowComponent } from '../../components/business-row/business-row.component';
import { SessionService } from '../../core/session.service';
import { BreakpointService } from '../../core/breakpoint.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { ButtonComponent } from '../../components/button/button.component';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../data/app-links';
import { HELP_BUSINESS_URL } from '../../data/site.data';

type Coords = { lat: number; lng: number };

/**
 * Las tres filas de la app —favoritos, volver a reservar y destacados— van de
 * cinco en cinco y piden más al llegar al final, como `PagedBusinessRow`. Antes
 * se pedían doce de golpe: la fila enseña dos o tres a la vez y el resto era
 * trabajo tirado, también en el servidor.
 */
const ROW_PAGE = 5;
type PagedRow = 'favorites' | 'rebook' | 'featured';
interface RowPager {
  /** La última página ya traída, contada en páginas de `ROW_PAGE`. */
  page: number;
  hasMore: boolean;
  loading: boolean;
}
const freshPager = (): RowPager => ({ page: 0, hasMore: false, loading: false });

/**
 * Explorar. Port de `ExploreScreen` con lo que la web añade por tener sitio.
 *
 * El orden de las filas es el de la app —**Tus favoritos primero**, después
 * Volver a reservar y Destacados— y la web suma las que se pueden calcular sin
 * endpoints nuevos: mejor valorados y recién abiertos.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    AvatarComponent,
    SearchBarComponent,
    CommonModule,
    RouterLink,
    FormsModule,
    BusinessCardComponent,
    BusinessRowComponent,
    ButtonComponent,
    DragScrollDirective,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', './home-blocks.css']
})
export class HomeComponent implements OnInit {
  // Los badges de las tiendas, del mismo sitio que la tira de descarga.
  // Apuntaban a youtube.com, heredado de la plantilla.
  readonly appStoreUrl = APP_STORE_URL;
  readonly playStoreUrl = PLAY_STORE_URL;
  /** «Abre ya tu negocio». También iba a youtube.com: un botón que no lleva
   *  a nada es lo que más hace parecer de demo una web. */
  readonly businessInfoUrl = HELP_BUSINESS_URL;

  private readonly bipsyService = inject(BipsyService);
  private readonly catalog = inject(CatalogRepository);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Cabecera de app o héroe de escritorio: solo se monta el que se ve. */
  readonly desktop = inject(BreakpointService).desktop;

  /** La ✕ del aviso de ubicación del móvil. Vuelve en la siguiente visita, como en la app. */
  locateDismissed = false;

  @ViewChild('discover') discoverRef?: ElementRef<HTMLElement>;

  selectedCategoryCode = 'ALL';
  searchQuery = '';

  categories: CategoryResponse[] = [];
  /** La lista de la categoría abierta. */
  businesses: BusinessResponse[] = [];
  featuredBusinesses: BusinessResponse[] = [];
  favoriteBusinesses: BusinessResponse[] = [];
  rebookBusinesses: BusinessResponse[] = [];
  topRatedBusinesses: BusinessResponse[] = [];
  newBusinesses: BusinessResponse[] = [];

  isAuthenticated = false;
  isLoading = true;
  favoritesLoading = true;
  categoryLoading = false;
  loadError: ApiError | null = null;

  /** Dónde está quien mira, solo si ya dio permiso antes: no se pregunta al entrar. */
  private coords?: Coords;
  locationOn = false;

  readonly skeletons = [1, 2, 3, 4, 5, 6];

  /** La sesión ya se ha comprobado: hasta entonces no se sabe si es invitado. */
  sessionKnown = false;

  /** Cuántos negocios devuelve el catálogo, para la línea bajo el buscador. */
  catalogCount = 0;
  /** Los que ponen cara a esa línea: solo los que tienen foto propia. */
  heroBusinesses: BusinessResponse[] = [];

  /** Null si el negocio no tiene foto: la plantilla pinta el hueco de marca. */
  businessImage(business: BusinessResponse): string | null {
    return fixImageUrl(business.profileImageUrl || business.coverImageUrl);
  }

  ngOnInit(): void {
    // Las filas personales dependen de la sesión, y la sesión tarda un
    // instante en resolverse al arrancar: sin esperar a que se sepa, la
    // portada se pintaba siempre como si nadie hubiera entrado.
    this.session.status$
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(status => {
        if (status === 'unknown') {
          return;
        }
        this.isAuthenticated = status === 'authenticated';
        this.sessionKnown = true;
        this.heroBooking = null;
        this.upcomingCount = 0;
        if (this.isAuthenticated) {
          void this.loadHeroBooking();
        }
        void this.loadData();
      });

    // Guardar o quitar un favorito desde cualquier tarjeta mueve la primera
    // fila al momento, como en la app.
    this.session.favoriteBusinessIds$
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isAuthenticated) {
          void this.loadFavorites(false);
        }
      });

    void this.detectLocation();
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;
    this.rowGeneration++;

    void this.loadFavorites(true);
    try {
      const [cats, featured, rebook, sample] = await Promise.all([
        this.bipsyService.getCategories(),
        this.bipsyService.getFeaturedBusinesses(ROW_PAGE, this.coords),
        this.bipsyService.getRebookableBusinesses(0, ROW_PAGE),
        this.bipsyService.getCatalogSample(60, this.coords),
      ]);
      this.categories = [{ id: 0, code: 'ALL', name: 'Todo', active: true }, ...cats];
      this.featuredBusinesses = featured;
      this.pagers.featured = { page: 0, hasMore: featured.length === ROW_PAGE, loading: false };
      this.rebookBusinesses = rebook.map(markRebookable);
      this.pagers.rebook = { page: 0, hasMore: rebook.length === ROW_PAGE, loading: false };
      this.topRatedBusinesses = topRated(sample);
      this.newBusinesses = sample.filter(b => b.discovery?.recentlyOpened).slice(0, 12);
      this.catalogCount = sample.length;
      // Las chinchetas son decorativas: basta con las fotos, tengan o no coordenadas.
      this.mapPins = sample.slice(0, 6);
      this.refreshRows();
      // Una fila que se queda vacía por no repetir no se pinta, y sin pintar
      // no hay scroll que pida la página siguiente: se pide aquí.
      for (const key of ['rebook', 'featured'] as const) {
        if (this.shownRow(key).length === 0) void this.loadMoreRow(key);
      }
      this.loadDesktopBlocks(sample);
      // Solo los que tienen foto propia: una fila de iconos de tienda no pone
      // cara a nada. Con menos de dos, la línea no se pinta.
      this.heroBusinesses = sample.filter(b => b.profileImageUrl || b.coverImageUrl).slice(0, 4);
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ----- BLOQUES CALCULADOS --------------------

  /** Los que abren hoy. El servidor filtra por día de la semana. */
  openToday: BusinessResponse[] = [];
  cities: CityTile[] = [];
  /** Título y subtítulo del bloque de ciudades según de dónde salgan. */
  citiesTitle = '';
  citiesSubtitle = '';

  // ----- FILAS SIN REPETIDOS --------------------
  //
  // Un negocio sale en UNA fila: la primera a la que pertenece. Con el mismo
  // sitio en favoritos, en volver a reservar y en destacados la portada decía
  // tres veces lo mismo.
  rebookRow: BusinessResponse[] = [];
  featuredRow: BusinessResponse[] = [];
  openTodayRow: BusinessResponse[] = [];

  private refreshRows(): void {
    const seen = new Set(this.favoriteBusinesses.map(b => b.id));
    const take = (list: BusinessResponse[]) => {
      const out = list.filter(b => !seen.has(b.id));
      out.forEach(b => seen.add(b.id));
      return out;
    };
    this.rebookRow = take(this.rebookBusinesses);
    this.featuredRow = take(this.featuredBusinesses);
    this.openTodayRow = take(this.openToday);
    this.topRatedRow = take(this.topRatedBusinesses);
    this.newRow = take(this.newBusinesses);
  }

  topRatedRow: BusinessResponse[] = [];
  newRow: BusinessResponse[] = [];

  // ----- FILAS PAGINADAS --------------------

  readonly pagers: Record<PagedRow, RowPager> = {
    favorites: freshPager(),
    rebook: freshPager(),
    featured: freshPager(),
  };

  /** Lo que se ve de cada fila paginada, después de quitar repetidos. */
  private shownRow(key: PagedRow): BusinessResponse[] {
    return key === 'favorites' ? this.favoriteBusinesses : key === 'rebook' ? this.rebookRow : this.featuredRow;
  }

  private sourceRow(key: PagedRow): BusinessResponse[] {
    return key === 'favorites'
      ? this.favoriteBusinesses
      : key === 'rebook' ? this.rebookBusinesses : this.featuredBusinesses;
  }

  private fetchRowPage(key: PagedRow, page: number): Promise<BusinessResponse[]> {
    switch (key) {
      case 'favorites':
        return this.bipsyService.getFavoriteBusinesses(page, ROW_PAGE);
      case 'rebook':
        return this.bipsyService.getRebookableBusinesses(page, ROW_PAGE).then(list => list.map(markRebookable));
      case 'featured':
        return this.bipsyService.getFeaturedBusinesses(ROW_PAGE, this.coords, page);
    }
  }

  /**
   * La página siguiente de una fila, añadida a lo que ya hay.
   *
   * El guardia evita la avalancha: el scroll avisa muchas veces seguidas y sin
   * él se pedirían varias páginas iguales a la vez. Y como una fila no repite
   * lo que ya salió más arriba, una página entera puede no añadir nada visible
   * —cinco destacados que ya eran favoritos—: entonces se pide otra, hasta tres,
   * o la fila se quedaría parada sin scroll que la despierte.
   */
  async loadMoreRow(key: PagedRow): Promise<void> {
    const pager = this.pagers[key];
    if (pager.loading || !pager.hasMore) {
      return;
    }
    pager.loading = true;
    const generation = this.rowGeneration;
    try {
      for (let attempt = 0; attempt < 3 && pager.hasMore; attempt++) {
        const before = this.shownRow(key).length;
        const next = await this.fetchRowPage(key, pager.page + 1);
        // La portada se recargó mientras tanto (sesión, ubicación): esta
        // página es de la lista anterior.
        if (generation !== this.rowGeneration) return;
        const seen = new Set(this.sourceRow(key).map(b => b.id));
        const fresh = next.filter(b => !seen.has(b.id));
        pager.page++;
        pager.hasMore = next.length === ROW_PAGE && fresh.length > 0;
        if (key === 'favorites') this.favoriteBusinesses = [...this.favoriteBusinesses, ...fresh];
        else if (key === 'rebook') this.rebookBusinesses = [...this.rebookBusinesses, ...fresh];
        else this.featuredBusinesses = [...this.featuredBusinesses, ...fresh];
        this.refreshRows();
        if (this.shownRow(key).length > before) break;
      }
    } catch {
      // Un fallo al pedir más no borra lo que ya se ve: la fila se queda así.
      pager.hasMore = false;
    } finally {
      pager.loading = false;
    }
  }

  /** Sube con cada recarga de las filas, para descartar páginas viejas. */
  private rowGeneration = 0;

  /**
   * Los bloques que dependen de DÓNDE está quien mira: ciudades y reseñas.
   *
   * Sin contexto no se inventa: con ubicación, lo que hay alrededor; sin ella,
   * la provincia de su perfil; y si no hay ninguna de las dos, las ciudades no
   * se enseñan — a alguien de Barcelona no le sirve ver Marchena.
   */
  /**
   * Abiertos hoy, ciudades y reseñas solo se pintan en escritorio: en el móvil
   * la portada es la de la app y ni se piden. Si después se pasa a escritorio
   * (una tablet que se gira), la siguiente carga los trae.
   */
  private loadDesktopBlocks(sample: BusinessResponse[]): void {
    if (!this.desktop()) return;
    void this.loadOpenToday();
    void this.loadLocalBlocks(sample);
  }

  private async loadLocalBlocks(sample: BusinessResponse[]): Promise<void> {
    let local: BusinessResponse[] = [];
    if (this.coords) {
      try {
        const page = await this.catalog.searchBusinesses({
          lat: this.coords.lat,
          lng: this.coords.lng,
          radiusKm: LOCAL_RADIUS_KM,
          size: 60,
        });
        local = page.content ?? [];
      } catch {
        local = [];
      }
      this.citiesTitle = 'Ciudades cerca de ti';
      this.citiesSubtitle = `Lo que hay en Bipsy a menos de ${LOCAL_RADIUS_KM} km`;
    } else {
      const province = (this.session.currentUser?.province ?? '').trim().toLowerCase();
      if (province) {
        local = sample.filter(b => (b.province ?? '').trim().toLowerCase() === province);
        this.citiesTitle = `Explora ${capitalize(province)}`;
        this.citiesSubtitle = 'Las ciudades de tu provincia con sitios en Bipsy';
      }
    }
    this.cities = local.length ? citiesOf(local) : [];
    // Las reseñas son una prueba de confianza: con contexto, de tu zona; sin
    // él, las de los negocios con más reseñas, con su ciudad a la vista.
    void this.loadCommunityReviews(local.length ? local : sample);
  }
  communityReviews: { review: ReviewResponse; business: BusinessResponse }[] = [];
  /** Negocios con coordenadas: sus fotos hacen de chinchetas en el bloque del mapa. */
  mapPins: BusinessResponse[] = [];

  get todayName(): string {
    return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(new Date());
  }

  private async loadOpenToday(): Promise<void> {
    try {
      const list = await this.bipsyService.searchBusinesses({
        availableOn: isoDate(new Date()),
        size: 12,
        lat: this.coords?.lat,
        lng: this.coords?.lng,
      });
      this.openToday = list.slice(0, 12);
    } catch {
      this.openToday = [];
    }
    this.refreshRows();
  }

  /**
   * Reseñas de verdad, con comentario, de los negocios con más reseñas. Una
   * llamada pequeña por negocio y ninguna puede tumbar la portada.
   */
  private async loadCommunityReviews(sample: BusinessResponse[]): Promise<void> {
    const top = [...sample]
      .filter(b => (b.reviewCount ?? 0) > 0)
      .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
      .slice(0, 6);
    const pages = await Promise.allSettled(top.map(b => this.catalog.reviewsByBusiness(b.id, 0, 3)));
    const out: { review: ReviewResponse; business: BusinessResponse }[] = [];
    pages.forEach((page, i) => {
      if (page.status !== 'fulfilled') return;
      for (const review of page.value.content ?? []) {
        if (review.comment && review.comment.trim().length >= 12 && review.rating >= 4) {
          out.push({ review, business: top[i] });
        }
      }
    });
    this.communityReviews = out
      .sort((a, b) => (b.review.createdAt ?? '').localeCompare(a.review.createdAt ?? ''))
      .slice(0, 8);
  }

  reviewAuthor(review: ReviewResponse): string {
    return reviewAuthor(review);
  }

  reviewAuthorPhoto(review: ReviewResponse): string | null {
    return fixImageUrl(review.customerProfileImageUrl) ?? null;
  }

  stars(rating: number): number[] {
    return [1, 2, 3, 4, 5].map(i => (i <= Math.round(rating) ? 1 : 0));
  }

  /** Flechas de las filas horizontales: casi una pantalla de fila por clic. */
  scrollRow(el: HTMLElement, direction: 1 | -1): void {
    el.scrollBy({ left: direction * Math.max(280, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  openReviewBusiness(business: BusinessResponse): void {
    this.router.navigate(businessPath(business));
  }

  businessLink(business: BusinessResponse): string[] {
    return businessPath(business);
  }

  openCity(city: CityTile): void {
    this.router.navigate(['/buscar'], { queryParams: { city: city.name } });
  }

  private async loadFavorites(showSkeleton: boolean): Promise<void> {
    if (showSkeleton) {
      this.favoritesLoading = true;
    }
    // Al guardar o quitar uno se recarga lo que ya estaba a la vista —en
    // múltiplos de la página—, no solo la primera: si no, la fila se encogía
    // de golpe a cinco tarjetas mientras se estaba mirando la duodécima.
    const pages = showSkeleton ? 1 : Math.max(1, Math.ceil(this.favoriteBusinesses.length / ROW_PAGE));
    const size = pages * ROW_PAGE;
    try {
      const list = await this.bipsyService.getFavoriteBusinesses(0, size);
      this.favoriteBusinesses = list;
      // `page` cuenta en páginas de ROW_PAGE: con 15 de golpe, la siguiente es la 3.
      this.pagers.favorites = { page: pages - 1, hasMore: list.length === size, loading: false };
    } finally {
      this.favoritesLoading = false;
      this.refreshRows();
    }
  }

  /**
   * Destacados se ordena por distancia cuando se sabe dónde estás. Solo se
   * pide la posición si el permiso YA está concedido: un diálogo del navegador
   * nada más entrar es la forma más rápida de que lo deniegues.
   */
  private async detectLocation(): Promise<void> {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      if (status?.state === 'granted') {
        this.requestLocation();
      }
    } catch {
      // Navegadores sin Permissions API: sin distancia, la fila sale igual.
    }
  }

  /** Lo pulsa quien quiere ver lo que tiene cerca. */
  requestLocation(): void {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        this.coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        this.locationOn = true;
        void this.refreshNearby();
      },
      () => (this.locationOn = false),
      { maximumAge: 10 * 60_000, timeout: 10_000 },
    );
  }

  private async refreshNearby(): Promise<void> {
    try {
      const [featured, sample] = await Promise.all([
        this.bipsyService.getFeaturedBusinesses(ROW_PAGE, this.coords),
        this.bipsyService.getCatalogSample(60, this.coords),
      ]);
      // Destacados vuelve a empezar, ahora ordenado por distancia.
      this.rowGeneration++;
      this.featuredBusinesses = featured;
      this.pagers.featured = { page: 0, hasMore: featured.length === ROW_PAGE, loading: false };
      this.refreshRows();
      this.loadDesktopBlocks(sample);
    } catch {
      // Se quedan los de antes, sin distancia.
    }
  }

  // ----- CATEGORÍAS --------------------

  /**
   * Las categorías como las pinta Android: **sin cuadro «Todo»** y con
   * barbería primero, que es la que más negocios tiene.
   */
  get tileCategories(): CategoryResponse[] {
    const real = this.categories.filter(c => c.code !== 'ALL');
    const isBarber = (code: string) => code === 'BARBER' || code === 'BARBERSHOP';
    return [...real].sort((a, b) => Number(isBarber(b.code)) - Number(isBarber(a.code)));
  }

  /** Las cinco primeras, como atajos bajo el buscador del hero. */
  get popularCategories(): CategoryResponse[] {
    return this.tileCategories.slice(0, 5);
  }

  /** Toca la ya elegida y se deselecciona, como en la app. */
  toggleCategory(cat: CategoryResponse, scroll = false): void {
    if (this.selectedCategoryCode === cat.code) {
      this.clearCategory();
      return;
    }
    void this.selectCategory(cat);
    if (scroll) {
      this.discoverRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  clearCategory(): void {
    this.selectedCategoryCode = 'ALL';
    this.businesses = [];
  }

  get selectedCategoryName(): string {
    return this.categories.find(c => c.code === this.selectedCategoryCode)?.name ?? 'esta categoría';
  }

  retryCategory(): void {
    const cat = this.categories.find(c => c.code === this.selectedCategoryCode);
    if (cat) {
      void this.selectCategory(cat);
    }
  }

  async selectCategory(cat: CategoryResponse): Promise<void> {
    this.selectedCategoryCode = cat.code;
    if (cat.id === 0) {
      this.clearCategory();
      return;
    }
    // Tocar dos categorías seguidas lanza dos búsquedas: si la primera tarda
    // más, sus negocios acababan pintados bajo el nombre de la segunda.
    const seq = ++this.categorySeq;
    this.categoryLoading = true;
    this.loadError = null;
    try {
      const businesses = await this.bipsyService.searchBusinesses({
        categoryId: cat.id,
        lat: this.coords?.lat,
        lng: this.coords?.lng,
      });
      if (seq === this.categorySeq && this.selectedCategoryCode === cat.code) {
        this.businesses = businesses;
      }
    } catch (error) {
      if (seq === this.categorySeq) this.loadError = ApiError.from(error);
    } finally {
      if (seq === this.categorySeq) this.categoryLoading = false;
    }
  }

  private categorySeq = 0;

  getCategoryIcon(code: string): string {
    return categoryIcon(code);
  }

  /** El botón de filtros abre la hoja de Buscar, que es la misma de la app. */
  openFilters(): void {
    void this.router.navigate(['/buscar'], { queryParams: { filtros: 1 } });
  }

  executeSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/buscar'], { queryParams: { q: this.searchQuery } });
    }
  }

  /**
   * Volver a reservar lo mismo. No abre la ficha: entra directo al flujo con
   * el servicio de la última cita, que es el trabajo que este botón ahorra.
   */
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

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/' } });
  }

  goToRegister(): void {
    this.router.navigate(['/crear-cuenta']);
  }

  goToSearch(): void {
    this.router.navigate(['/buscar']);
  }

  // ----- PRÓXIMA CITA --------------------

  /** La próxima cita activa, o la última que hubo si no hay ninguna. */
  heroBooking: BookingResponse | null = null;
  heroBookingIsPast = false;
  /** Cuántas más hay por delante, aparte de la que se enseña. */
  upcomingCount = 0;

  /**
   * Mismo criterio que Mis citas para no decir cosas distintas en dos
   * pantallas: próxima es la que empieza en el futuro Y sigue activa.
   */
  private async loadHeroBooking(): Promise<void> {
    try {
      const all: BookingResponse[] = await this.bipsyService.getMyBookings();
      const now = Date.now();
      const isUpcoming = (b: BookingResponse) => parseLocal(b.startDateTime).getTime() > now && isBookingActive(b);
      const upcoming = all.filter(isUpcoming).sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

      if (upcoming.length) {
        this.heroBooking = upcoming[0];
        this.heroBookingIsPast = false;
        this.upcomingCount = upcoming.length - 1;
        return;
      }
      const past = all.filter(b => !isUpcoming(b)).sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));
      this.heroBooking = past[0] ?? null;
      this.heroBookingIsPast = !!past.length;
    } catch {
      this.heroBooking = null;
    }
  }

  get heroBookingLabel(): string {
    const b = this.heroBooking;
    if (!b) return '';
    if (b.status === 'CANCELED') return 'Cancelada';
    if (b.status === 'NO_SHOW') return 'No acudiste';
    if (this.heroBookingIsPast) return 'Terminada';
    return b.status === 'PENDING' ? 'Pendiente' : 'Confirmada';
  }

  get heroBookingTone(): string {
    const b = this.heroBooking;
    if (!b) return 'subtle';
    if (b.status === 'CANCELED' || b.status === 'NO_SHOW') return 'danger';
    if (this.heroBookingIsPast) return 'subtle';
    return b.status === 'PENDING' ? 'warn' : 'mint';
  }

  get heroBookingDay(): string {
    return this.heroBooking ? relativeDate(parseLocal(this.heroBooking.startDateTime)) : '';
  }

  get heroBookingLongDate(): string {
    return this.heroBooking ? longDate(parseLocal(this.heroBooking.startDateTime)) : '';
  }

  get heroBookingTime(): string {
    return this.heroBooking ? this.heroBooking.startDateTime.slice(11, 16) : '';
  }

  /** Día del mes y mes corto para la hoja de calendario de la tarjeta. */
  get heroBookingDate(): { day: string; month: string } {
    if (!this.heroBooking) return { day: '', month: '' };
    const d = parseLocal(this.heroBooking.startDateTime);
    const month = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(d).replace('.', '');
    return { day: String(d.getDate()), month };
  }

  get heroBookingImage(): string | null {
    return fixImageUrl(this.heroBooking?.serviceImageUrl) ?? null;
  }

  openHeroBooking(): void {
    if (this.heroBooking) {
      void this.router.navigate(['/citas', this.heroBooking.id]);
    }
  }

  // ----- CABECERA --------------------

  /**
   * Sin sesión, «Bienvenido»: un «Hola» a secas suena a que deberíamos saber
   * quién eres y no lo sabemos. Es literal de la app.
   */
  get greeting(): string {
    const name = this.firstName;
    return name ? `Hola, ${name}` : 'Bienvenido';
  }

  get firstName(): string | undefined {
    return this.session.currentUser?.name?.trim().split(/\s+/)[0];
  }

  /** Buenos días / tardes / noches, para el eyebrow del hero con sesión. */
  get dayPart(): string {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 14) return 'Buenos días';
    if (h < 21) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get avatarPhoto(): string | null {
    return this.session.currentUser?.profileImageUrl ?? null;
  }

  get avatarName(): string | null {
    return this.session.currentUser?.name ?? null;
  }

  get avatarLink(): string {
    return this.session.currentUser ? '/ajustes' : '/acceder';
  }
}

/** Radio del bloque de ciudades cercanas. */
const LOCAL_RADIUS_KM = 40;

export interface CityTile {
  name: string;
  count: number;
  /** Null si ningún negocio de la ciudad tiene foto. */
  image: string | null;
}

/** Ciudades del catálogo, de la que más negocios tiene a la que menos. */
function citiesOf(list: BusinessResponse[]): CityTile[] {
  const map = new Map<string, BusinessResponse[]>();
  for (const b of list) {
    const city = (b.city ?? '').trim();
    if (!city || b.worksAtHome) continue;
    map.set(city, [...(map.get(city) ?? []), b]);
  }
  return [...map.entries()]
    .map(([name, items]) => {
      const withPhoto = items.find(b => b.coverImageUrl || b.profileImageUrl) ?? items[0];
      return {
        name,
        count: items.length,
        image: fixImageUrl(withPhoto.coverImageUrl || withPhoto.profileImageUrl),
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6);
}

/** Los de volver a reservar llevan el reloj y el botón redondo. */
function markRebookable(business: BusinessResponse): BusinessResponse {
  return {
    ...business,
    discovery: { featured: false, recentlyOpened: false, ...business.discovery, previouslyBooked: true },
  };
}

/**
 * Mejor valorados: nota media y, a igualdad, más reseñas. Con menos de dos
 * reseñas un 5 no dice nada, así que no entran.
 */
function topRated(list: BusinessResponse[]): BusinessResponse[] {
  const rated = list
    .filter(b => (b.reviewCount ?? 0) >= 2 && (b.averageRating ?? 0) >= 4)
    .sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  return rated.length >= 3 ? rated.slice(0, 12) : [];
}
