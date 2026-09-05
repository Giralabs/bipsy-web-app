import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BipsyService } from '../../services/bipsy.service';
import { ApiError } from '../../core/api-error';
import {
  BookingResponse,
  BusinessResponse,
  CategoryResponse,
  isBookingActive,
} from '../../models/bipsy.models';
import { parseLocal, relativeDate } from '../../shared/dates';
import { categoryIcon } from '../../shared/category-icons';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { BusinessRowComponent } from '../../components/business-row/business-row.component';
import { SessionService } from '../../core/session.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { ButtonComponent } from '../../components/button/button.component';
import { ChipComponent } from '../../components/chip/chip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [AvatarComponent, SearchBarComponent, CommonModule, RouterLink, FormsModule, BusinessCardComponent, BusinessRowComponent, ButtonComponent, ChipComponent, DragScrollDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  selectedCategoryCode: string = 'ALL';
  selectedCategoryId?: number;
  searchQuery: string = '';

  categories: CategoryResponse[] = [];
  businesses: BusinessResponse[] = [];
  featuredBusinesses: BusinessResponse[] = [];

  favoriteBusinesses: BusinessResponse[] = [];
  isAuthenticated = false;
  isLoading: boolean = true;
  loadError: ApiError | null = null;

  /** Cuántos esqueletos pintar mientras carga. Seis llenan la fila. */
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor(
    private bipsyService: BipsyService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Las filas personales dependen de la sesión, y la sesión tarda un
    // instante en resolverse al arrancar: sin esperar a que se sepa, la
    // portada se pintaba siempre como si nadie hubiera entrado.
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      // La cita del hero solo se pide con sesión: sin ella el hero es el
      // cartel de siempre y una llamada más sería un 401 para nada.
      this.heroBooking = null;
      if (this.isAuthenticated) {
        void this.loadHeroBooking();
      }
      void this.loadData();
    });
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      const [cats, featured, favorites, rebook] = await Promise.all([
        this.bipsyService.getCategories(),
        this.bipsyService.getFeaturedBusinesses(12),
        this.bipsyService.getFavoriteBusinesses(),
        this.bipsyService.getRebookableBusinesses(),
      ]);
      this.categories = [{ id: 0, code: 'ALL', name: 'Todo', active: true }, ...cats];
      this.featuredBusinesses = withRebookablesFirst(featured, rebook);
      this.businesses = featured;
      this.favoriteBusinesses = favorites;
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Las categorías como las pinta Android: **sin cuadro «Todo»** y con
   * barbería primero, que es la que más negocios tiene.
   *
   * En la app no hay tarjeta de «todas»: se vuelve a las filas de
   * descubrimiento tocando otra vez la categoría ya elegida.
   */
  get tileCategories(): CategoryResponse[] {
    const real = this.categories.filter(c => c.code !== 'ALL');
    const isBarber = (code: string) => code === 'BARBER' || code === 'BARBERSHOP';
    return [...real].sort((a, b) => Number(isBarber(b.code)) - Number(isBarber(a.code)));
  }

  /** Toca la ya elegida y se deselecciona, como en la app. */
  toggleCategory(cat: CategoryResponse): void {
    if (this.selectedCategoryCode === cat.code) {
      void this.selectCategory({ id: 0, code: 'ALL', name: 'Todo', active: true });
      return;
    }
    void this.selectCategory(cat);
  }

  /** El nombre de la categoría abierta, para el cartel de «no hay nada». */
  get selectedCategoryName(): string {
    return this.categories.find(c => c.code === this.selectedCategoryCode)?.name ?? 'esta categoría';
  }

  /** Reintenta la categoría abierta sin volver a «Todo». */
  retryCategory(): void {
    const cat = this.categories.find(c => c.code === this.selectedCategoryCode);
    if (cat) {
      void this.selectCategory(cat);
    }
  }

  /** El botón de filtros abre la hoja de Buscar, que es la misma de la app. */
  openFilters(): void {
    void this.router.navigate(['/search'], { queryParams: { filtros: 1 } });
  }

  async selectCategory(cat: CategoryResponse): Promise<void> {
    this.selectedCategoryCode = cat.code;
    this.selectedCategoryId = cat.id === 0 ? undefined : cat.id;
    if (cat.id === 0) {
      await this.loadData();
      return;
    }

    this.isLoading = true;
    this.loadError = null;
    try {
      const res = await this.bipsyService.searchBusinesses({ categoryId: cat.id });
      this.businesses = res;
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Volver a reservar lo mismo. No abre la ficha: entra directo al flujo con
   * el servicio de la última cita, que es el trabajo que este botón ahorra.
   * Sin ese dato no se puede repetir nada y se cae a la ficha.
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

  // ----- HERO PERSONALIZADO --------------------
  //
  // Con sesión, el hero deja de ser un cartel y pasa a ser tu cita: lo que
  // alguien que ya usa Bipsy quiere ver al entrar es si tiene algo reservado,
  // no un titular que ya ha leído. Sin sesión no cambia nada.
  /** La próxima cita activa, o la última que hubo si no hay ninguna. */
  heroBooking: BookingResponse | null = null;
  /** True cuando la que se enseña ya pasó: cambia el tono y la acción. */
  heroBookingIsPast = false;

  /**
   * La cita del hero.
   *
   * Mismo criterio que Mis citas para no decir cosas distintas en dos
   * pantallas: próxima es la que empieza en el futuro Y sigue activa; el resto
   * es pasado, y de ahí se coge la más reciente.
   */
  private async loadHeroBooking(): Promise<void> {
    try {
      const all: BookingResponse[] = await this.bipsyService.getMyBookings();
      const now = Date.now();
      const upcoming = all
        .filter(b => parseLocal(b.startDateTime).getTime() > now && isBookingActive(b))
        .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

      if (upcoming.length) {
        this.heroBooking = upcoming[0];
        this.heroBookingIsPast = false;
        return;
      }
      const past = all
        .filter(b => !(parseLocal(b.startDateTime).getTime() > now && isBookingActive(b)))
        .sort((a, b) => b.startDateTime.localeCompare(a.startDateTime));
      this.heroBooking = past[0] ?? null;
      this.heroBookingIsPast = !!past.length;
    } catch {
      // El hero no puede caerse por esto: sin cita se enseña el de siempre.
      this.heroBooking = null;
    }
  }

  /**
   * Lo que se lee bajo el nombre del negocio.
   *
   * «Terminada» no es un estado del servidor: una cita confirmada cuya hora ya
   * pasó está CONFIRMED para siempre. Se deduce aquí, que es donde se sabe qué
   * hora es.
   */
  get heroBookingLabel(): string {
    const b = this.heroBooking;
    if (!b) return '';
    if (b.status === 'CANCELED') return 'Cancelada';
    if (b.status === 'NO_SHOW') return 'No acudiste';
    if (this.heroBookingIsPast) return 'Terminada';
    return b.status === 'PENDING' ? 'Pendiente de confirmar' : 'Confirmada';
  }

  get heroBookingTone(): string {
    const b = this.heroBooking;
    if (!b) return 'subtle';
    if (b.status === 'CANCELED' || b.status === 'NO_SHOW') return 'danger';
    if (this.heroBookingIsPast) return 'subtle';
    return b.status === 'PENDING' ? 'warn' : 'mint';
  }

  /** Cuándo es (o fue), en una línea. */
  get heroBookingWhen(): string {
    const b = this.heroBooking;
    if (!b) return '';
    const start = parseLocal(b.startDateTime);
    return `${relativeDate(start)} · ${b.startDateTime.slice(11, 16)}`;
  }

  openHeroBooking(): void {
    if (this.heroBooking) {
      void this.router.navigate(['/appointments', this.heroBooking.id]);
    }
  }

  /**
   * El saludo de la cabecera de Explorar.
   *
   * Sin sesión, «Bienvenido»: un «Hola» a secas suena a que deberíamos saber
   * quién eres y no lo sabemos. Es literal de la app.
   */
  get greeting(): string {
    const name = this.session.currentUser?.name?.trim().split(/\s+/)[0];
    return name ? `Hola, ${name}` : 'Bienvenido';
  }

  get avatarPhoto(): string | null {
    return this.session.currentUser?.profileImageUrl ?? null;
  }

  get avatarName(): string | null {
    return this.session.currentUser?.name ?? null;
  }

  /** Con sesión, a los ajustes; sin ella, a entrar. Igual que en la app. */
  get avatarLink(): string {
    return this.session.currentUser ? '/profile' : '/acceder';
  }

  executeSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  getSelectedCategoryName(): string {
    const cat = this.categories.find(c => c.code === this.selectedCategoryCode);
    return cat?.name || 'Resultados';
  }

  getCategoryIcon(code: string): string {
    return categoryIcon(code);
  }

  clientEmail: string = '';

  onDownloadClick(): void {
    if (this.clientEmail.trim()) {
      alert(`¡Enlace de descarga enviado a ${this.clientEmail.trim()}! Redirigiendo a la descarga...`);
      window.open('https://www.youtube.com', '_blank');
    } else {
      alert('Por favor, introduce tu correo electrónico.');
    }
  }
}

/**
 * Los sitios donde ya has reservado, delante de los destacados.
 *
 * No son una fila aparte: "volver a reservar" no es una categoría, es una
 * acción sobre un negocio que ya conoces. Puesto como fila propia repetía los
 * mismos negocios dos veces y partía la portada en trozos que dicen lo mismo.
 * Aquí van primeros y con su icono, que es lo que los distingue.
 *
 * Se marcan con `discovery.previouslyBooked` para que la tarjeta saque el
 * reloj y el botón redondo sin que la fila tenga que saber de dónde salieron.
 */
function withRebookablesFirst(
  featured: BusinessResponse[],
  rebookable: BusinessResponse[],
): BusinessResponse[] {
  if (rebookable.length === 0) {
    return featured;
  }
  const first = rebookable.map(business => ({
    ...business,
    discovery: { featured: false, recentlyOpened: false, ...business.discovery, previouslyBooked: true },
  }));
  const seen = new Set(first.map(b => b.id));
  return [...first, ...featured.filter(b => !seen.has(b.id))];
}
