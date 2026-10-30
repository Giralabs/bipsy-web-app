import { Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { ChatRepository } from '../../repositories/chat.repository';
import { DialogService } from '../../core/dialog.service';
import { BookingRepository } from '../../repositories/booking.repository';
import {
  PortfolioViewerComponent,
  PortfolioViewerImage,
} from '../../components/portfolio-viewer/portfolio-viewer.component';
import {
  BookingResponse,
  BusinessPolicyGroup,
  BusinessResponse,
  PortfolioItem,
  ReviewResponse,
  ScheduleDayResponse,
  ServiceResponse,
  businessLocationDisplay,
  chargesCancellation,
  isBookingActive,
  primaryCategory,
} from '../../models/bipsy.models';
import { isAwaitingCustomer } from '../../models/confirm.models';
import { ButtonComponent } from '../../components/button/button.component';
import { ReportSheetComponent } from '../../components/report-sheet/report-sheet.component';
import { SocialLink, businessSocialLinks } from '../../models/business-social.models';
import { duration, euros, parseLocal } from '../../shared/dates';
import { fixImageUrl } from '../../shared/image-url';
import { categoryIcon } from '../../shared/category-icons';
import { PageMetaService } from '../../core/page-meta.service';
import { businessBookingPath, businessIdFromParam, businessSlug } from '../../shared/slug';

/**
 * Reseñas por página. Más que las 3 de la app: en escritorio caben, y con tres
 * la sección se quedaba corta al lado de la barra lateral.
 */
const REVIEWS_PAGE_SIZE = 5;

/** El mismo orden que la app: las mejores primero. */
const REVIEWS_SORT = 'rating,desc';

/**
 * Fotos de la tira de la galería, como `_previewLimit` de la app: es el
 * escaparate y se recorre de lado, así que pasado un punto deja de mirarse. El
 * resto están en la hoja que abre la flecha.
 */
const GALLERY_PREVIEW = 10;

/**
 * El servicio con el sitio donde se presta. El modelo compartido aún no lo
 * declara, pero el backend lo manda (`ServiceResponse.serviceMode`).
 */
type ServiceWithPlace = ServiceResponse & {
  serviceMode?: 'AT_BUSINESS' | 'AT_CUSTOMER' | 'BOTH';
  homeSurchargeCents?: number;
};

type ShowcaseSection = 'GALLERY' | 'SERVICES' | 'REVIEWS';
const DEFAULT_SECTION_ORDER: ShowcaseSection[] = ['GALLERY', 'SERVICES', 'REVIEWS'];

/** Los siete días en orden, con el nombre que manda el backend. */
const WEEKDAYS: { code: string; label: string }[] = [
  { code: 'MONDAY', label: 'Lunes' },
  { code: 'TUESDAY', label: 'Martes' },
  { code: 'WEDNESDAY', label: 'Miércoles' },
  { code: 'THURSDAY', label: 'Jueves' },
  { code: 'FRIDAY', label: 'Viernes' },
  { code: 'SATURDAY', label: 'Sábado' },
  { code: 'SUNDAY', label: 'Domingo' },
];

/**
 * Ficha pública de un negocio. Port de `GipsiBusinessDetailBody`.
 *
 * El orden es el de la app: portada, cabecera (con la descripción, las
 * acciones y las redes), galería, servicios y valoraciones —en el orden que
 * haya elegido el negocio— y, al final y en posición fija, las políticas.
 * Estuvieron arriba («Antes de reservar»); la app las bajó por decisión de
 * producto: quien mira una ficha viene a ver fotos, servicios y opiniones, y la
 * letra pequeña se lee cuando ya interesa.
 */
@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [CommonModule, ButtonComponent, ReportSheetComponent, PortfolioViewerComponent],
  templateUrl: './business-detail.component.html',
  styleUrl: './business-detail.component.css',
})
export class BusinessDetailComponent implements OnInit, OnDestroy {
  private readonly meta = inject(PageMetaService);
  private releaseMeta: (() => void) | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;
  /** El aviso flotante: «enlace copiado», «reporte enviado» o un fallo. */
  toast: string | null = null;
  toastIsError = false;

  private readonly bipsy = inject(BipsyService);
  private readonly catalog = inject(CatalogRepository);
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(DialogService);
  private readonly bookings = inject(BookingRepository);
  /** Para descartar respuestas de una ficha que ya no es la abierta. */
  private loadGeneration = 0;
  /**
   * Las citas del cliente, para el tope del negocio. Null mientras no han
   * llegado o si fallaron: entonces se deja pasar, como en la app.
   */
  private myBookings: BookingResponse[] | null = null;
  /** La foto abierta en el visor de la galería, o null. */
  viewerIndex: number | null = null;

  business?: BusinessResponse;
  services: ServiceResponse[] = [];
  reviews: ReviewResponse[] = [];
  policies: BusinessPolicyGroup[] = [];
  portfolio: PortfolioItem[] = [];
  schedule: ScheduleDayResponse[] = [];

  /** Total real de reseñas en el servidor, para «Ver más (n restantes)». */
  reviewTotal = 0;
  private reviewNextPage = 1;
  private reviewsLast = true;
  loadingMoreReviews = false;

  isLoading = true;
  /** Servicios, reseñas, galería, políticas y horario: la segunda tanda. */
  extrasLoading = true;
  loadError: ApiError | null = null;
  isFavorite = false;
  favoriteBusy = false;
  chatBusy = false;
  /** El horario desplegado en la barra lateral (escritorio). */
  scheduleOpen = false;
  /** El horario en hoja (móvil y tableta, desde la fila de acciones). */
  scheduleSheetOpen = false;
  reportOpen = false;
  /** La hoja con todas las fotos, que abre «Galería ›» (`showGipsiPortfolioSheet`). */
  galleryOpen = false;
  /** Enseña 5 normas como mucho: la ficha ya es larga. */
  allPoliciesOpen = false;

  ngOnInit(): void {
    // La sesión vive toda la visita: sin cortar, cada ficha abierta dejaba
    // su suscripción viva escribiendo en un componente ya destruido.
    this.session.favoriteBusinessIds$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(ids => {
      this.isFavorite = !!this.business && ids.includes(this.business.id);
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      void this.load(businessIdFromParam(params.get('id')));
    });
  }

  async load(id: number | null): Promise<void> {
    // Angular reutiliza el componente al saltar de una ficha a otra: sin
    // vaciar, se veían los servicios y fotos del negocio anterior, y una
    // respuesta lenta de aquel podía llegar después y pisar la del nuevo.
    const generation = ++this.loadGeneration;
    this.services = [];
    this.reviews = [];
    this.policies = [];
    this.portfolio = [];
    this.schedule = [];
    this.reviewTotal = 0;
    this.reviewsLast = true;
    this.allPoliciesOpen = false;
    this.viewerIndex = null;
    this.myBookings = null;
    if (id === null) {
      this.loadError = new ApiError(404, 'No hemos encontrado este negocio.');
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.loadError = null;
    try {
      const business = await this.bipsy.getBusinessById(id);
      if (generation !== this.loadGeneration) return;
      this.business = business;
      this.isFavorite = this.session.isFavorite(this.business.id);
      // El nombre en la pestaña: con el título genérico, cinco fichas abiertas
      // eran cinco pestañas iguales, y el lector de pantalla no decía dónde se
      // había llegado.
      this.releaseMeta?.();
      this.releaseMeta = this.meta.set(this.business.name);
    } catch (error) {
      if (generation !== this.loadGeneration) return;
      this.loadError = ApiError.from(error);
      this.isLoading = false;
      return;
    }
    this.isLoading = false;
    this.prefetchMyBookings(generation);

    // El resto se pide en paralelo y NINGUNO tumba la ficha: sin galería o sin
    // horario la ficha sigue sirviendo para lo que se viene, que es reservar.
    // Mientras llega, servicios y valoraciones enseñan su esqueleto: decían
    // «todavía no ha publicado su catálogo» y luego crecían de golpe.
    this.extrasLoading = true;
    const [services, , policies, portfolio, schedule] = await Promise.allSettled([
      this.bipsy.getBusinessServices(id),
      this.loadFirstReviews(id, generation),
      this.catalog.businessPolicies(id),
      this.catalog.businessPortfolio(id),
      this.catalog.businessSchedule(id),
    ]);
    if (generation !== this.loadGeneration) return;

    this.services = valueOr(services, []).filter(s => s.active);
    this.policies = valueOr(policies, []);
    this.portfolio = valueOr(portfolio, []);
    this.schedule = valueOr(schedule, []);
    this.extrasLoading = false;
  }

  /**
   * Primera página de reseñas, con el total para la paginación.
   *
   * Si la página falla se cae a `getReviewsByBusiness`, que es quien sabe
   * servir las de demostración sin backend; sin total no hay «Ver más», y la
   * ficha sigue valiendo igual.
   */
  private async loadFirstReviews(id: number, generation: number): Promise<void> {
    this.reviewNextPage = 1;
    try {
      const page = await this.catalog.reviewsByBusiness(id, 0, REVIEWS_PAGE_SIZE, REVIEWS_SORT);
      if (generation !== this.loadGeneration) return;
      this.reviews = page.content ?? [];
      this.reviewTotal = page.totalElements ?? this.reviews.length;
      this.reviewsLast = page.last ?? true;
    } catch {
      const reviews = await this.bipsy.getReviewsByBusiness(id).catch(() => []);
      if (generation !== this.loadGeneration) return;
      this.reviews = reviews;
      this.reviewTotal = this.reviews.length;
      this.reviewsLast = true;
    }
  }

  /** «Ver más»: la página siguiente, añadida a lo que ya hay. */
  async loadMoreReviews(): Promise<void> {
    if (!this.business || this.loadingMoreReviews) {
      return;
    }
    this.loadingMoreReviews = true;
    try {
      const page = await this.catalog.reviewsByBusiness(
        this.business.id,
        this.reviewNextPage,
        REVIEWS_PAGE_SIZE,
        REVIEWS_SORT,
      );
      // Por id: si alguien publica una reseña entre página y página, la misma
      // puede llegar dos veces, y repetida se lee como un fallo.
      const seen = new Set(this.reviews.map(r => r.id));
      this.reviews = [...this.reviews, ...(page.content ?? []).filter(r => !seen.has(r.id))];
      this.reviewTotal = page.totalElements ?? this.reviewTotal;
      this.reviewsLast = page.last ?? true;
      this.reviewNextPage++;
    } catch {
      this.showToast('No se han podido cargar más reseñas', true);
    } finally {
      this.loadingMoreReviews = false;
    }
  }

  get remainingReviews(): number {
    return this.reviewsLast ? 0 : Math.max(0, this.reviewTotal - this.reviews.length);
  }

  // ----- VISTA --------------------

  /**
   * Galería, servicios y valoraciones en el orden que haya elegido el negocio
   * (`branding.sectionOrder`, plan Quality). Sin plan, el de siempre. Lo que
   * no venga en la lista se añade al final: una sección no se pierde porque el
   * servidor mande un orden a medias.
   */
  get sectionOrder(): ShowcaseSection[] {
    const known = new Set<string>(DEFAULT_SECTION_ORDER);
    const order = (this.business?.branding?.sectionOrder ?? [])
      .filter((code): code is ShowcaseSection => known.has(code));
    const unique = [...new Set(order)];
    return [...unique, ...DEFAULT_SECTION_ORDER.filter(s => !unique.includes(s))];
  }

  /** Hay sitio al que ir: ni a domicilio ni sin dirección. */
  get hasPlace(): boolean {
    const b = this.business;
    if (!b || b.worksAtHome) {
      return false;
    }
    return this.locationDisplay.trim().length > 0 || (b.latitude != null && b.longitude != null);
  }

  /**
   * La dirección en Google Maps, para el enlace de la cabecera.
   *
   * Con el nombre delante, como hace la app: en una calle larga, «Estética
   * Luna» cae más cerca del portal que el número solo.
   */
  get mapsSearchUrl(): string {
    const b = this.business!;
    const query = `${b.name}, ${this.locationDisplay}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  /**
   * «Cómo llegar»: la ruta hasta el negocio. Con coordenadas si las hay —son
   * exactas—; si no, con el texto, que el buscador de Maps resuelve igual.
   */
  get directionsUrl(): string {
    const b = this.business!;
    const destination = b.latitude != null && b.longitude != null
      ? `${b.latitude},${b.longitude}`
      : `${b.name}, ${this.locationDisplay}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }

  /** Horario publicado. Sin él no se enseña nada: mejor que insinuar cerrado. */
  get hasSchedule(): boolean {
    return this.schedule.some(entry => entry.startTime && entry.endTime);
  }

  /**
   * Se puede ofrecer «Escribir»: el negocio quiere mensajes y quien mira no es
   * otro negocio. Sin sesión sí se ofrece; al pulsarlo se pide entrar.
   */
  get canWrite(): boolean {
    return !!this.business && this.business.chatEnabled !== false && this.isCustomerOrGuest;
  }

  /** Reportar es cosa de clientes, como en la app. Sin sesión, se pide entrar. */
  get canReport(): boolean {
    return this.isCustomerOrGuest;
  }

  private get isCustomerOrGuest(): boolean {
    if (!this.session.isAuthenticated) {
      return true;
    }
    const role = this.session.currentUser?.role;
    return !role || role === 'CUSTOMER';
  }

  get socialLinks(): SocialLink[] {
    return this.business ? businessSocialLinks(this.business) : [];
  }

  get locationDisplay(): string {
    return this.business ? businessLocationDisplay(this.business) : '';
  }

  get categoryName(): string | undefined {
    return this.business ? primaryCategory(this.business)?.name : undefined;
  }

  get hasRating(): boolean {
    return (this.business?.reviewCount ?? 0) > 0;
  }

  get ratingDisplay(): string {
    return (this.business?.averageRating ?? 0).toFixed(1).replace('.', ',');
  }

  get chargesCancellation(): boolean {
    return !!this.business && chargesCancellation(this.business);
  }

  get visiblePolicies(): BusinessPolicyGroup[] {
    if (this.allPoliciesOpen) {
      return this.policies;
    }
    // Cinco normas como mucho, repartidas por sus grupos. Por encima de eso
    // empujaría los servicios —a lo que se viene— fuera de la pantalla.
    let left = 5;
    const trimmed: BusinessPolicyGroup[] = [];
    for (const group of this.policies) {
      if (left <= 0) break;
      const slice = group.policies.slice(0, left);
      left -= slice.length;
      trimmed.push({ ...group, policies: slice });
    }
    return trimmed;
  }

  get totalPolicies(): number {
    return this.policies.reduce((sum, group) => sum + group.policies.length, 0);
  }

  /**
   * Los siete días, cada uno con sus tramos juntos.
   *
   * El backend manda una fila por tramo —mañana y tarde son dos—, así que se
   * agrupan: pintarlas tal cual daba catorce filas sin nombre de día. Y un día
   * sin ningún tramo está cerrado: no hay campo que preguntar.
   */
  get scheduleRows(): { day: string; hours: string; closed: boolean }[] {
    return WEEKDAYS.map(({ code, label }) => {
      const ranges = this.schedule
        .filter(entry => entry.dayOfWeek === code && entry.startTime && entry.endTime)
        .map(entry => `${trim(entry.startTime!)}–${trim(entry.endTime!)}`)
        .sort();
      return {
        day: label,
        hours: ranges.length > 0 ? ranges.join(' · ') : 'Cerrado',
        closed: ranges.length === 0,
      };
    });
  }

  price(service: ServiceResponse): string {
    return euros(service.price);
  }

  durationLabel(service: ServiceResponse): string {
    return duration(service.duration);
  }

  stars(rating: number): number[] {
    return [1, 2, 3, 4, 5].map(i => (i <= Math.round(rating) ? 1 : 0));
  }

  /**
   * Null sin foto: la plantilla pinta el hueco de marca, como la app.
   *
   * Solo la portada. Antes caía al logo si no había portada, y la app no lo
   * hace a propósito: en la ficha van uno encima de otro y salía repetido.
   */
  coverUrl(): string | null {
    return fixImageUrl(this.business?.coverImageUrl);
  }

  /** El logo, que va redondo junto al nombre (`_NameRow`). Sin él, solo el nombre. */
  logoUrl(): string | null {
    return fixImageUrl(this.business?.profileImageUrl);
  }

  /** La foto del servicio; sin ella, la miniatura lleva el icono de la categoría. */
  serviceImage(service: ServiceResponse): string | null {
    return fixImageUrl(service.imageUrl);
  }

  /** Icono de la categoría PRINCIPAL del negocio, como `GipsiCategoryIcons.forCode`. */
  get categoryIconName(): string {
    return categoryIcon(this.business ? primaryCategory(this.business)?.code : null);
  }

  /**
   * Dónde se presta un servicio, solo si se sale de lo esperable (`_placeNote`
   * de `GipsiServiceRow`): uno que también va a casa, o que solo va a casa en
   * un negocio con local. Uno que ya es a domicilio lo dice su cabecera.
   */
  placeNote(service: ServiceResponse): string | null {
    const s = service as ServiceWithPlace;
    const where = s.serviceMode === 'BOTH' ? 'También a domicilio'
      : s.serviceMode === 'AT_CUSTOMER' && !this.business?.worksAtHome ? 'Solo a domicilio'
      : null;
    if (!where) return null;
    return (s.homeSurchargeCents ?? 0) > 0 ? `${where} · +${euros(s.homeSurchargeCents! / 100)}` : where;
  }

  /** Iniciales de quien firma una reseña (`_initialsOf` de `GipsiReviewCard`). */
  reviewInitials(review: ReviewResponse): string {
    const parts = (review.customerName ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  reviewPhoto(review: ReviewResponse): string | null {
    return fixImageUrl(review.customerProfileImageUrl);
  }

  /** La fecha de la reseña como en la app: hoy, ayer, hace 3 días, hace 2 sem, 03/09/2026. */
  reviewDate(review: ReviewResponse): string {
    if (!review.createdAt) return '';
    const date = new Date(review.createdAt);
    const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (days < 1) return 'hoy';
    if (days < 2) return 'ayer';
    if (days < 7) return `hace ${days} días`;
    if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  /** Qué fila del horario es hoy, para marcarla en la barra lateral. */
  get todayLabel(): string {
    return WEEKDAYS[(new Date().getDay() + 6) % 7].label;
  }

  /** Las que enseña la tira de la ficha; el resto, en la hoja de «Galería ›». */
  get galleryPreview(): PortfolioItem[] {
    return this.portfolio.slice(0, GALLERY_PREVIEW);
  }

  /** La foto de un trabajo llega relativa a la API. */
  portfolioUrl(item: PortfolioItem): string {
    return fixImageUrl(item.url) ?? '';
  }

  /**
   * Una foto que no carga se quita de la galería.
   *
   * Pasa con ficheros que ya no están en el almacén: el registro sigue en la
   * base de datos y la URL responde 404. Dejarla puesta llenaba la sección de
   * huecos con el icono de imagen rota, que es peor que no enseñar la
   * sección.
   */
  onPortfolioError(item: PortfolioItem): void {
    this.portfolio = this.portfolio.filter(p => p.id !== item.id);
    // Con el visor abierto, que no apunte más allá de la última que queda.
    if (this.viewerIndex !== null) {
      this.viewerIndex = this.portfolio.length ? Math.min(this.viewerIndex, this.portfolio.length - 1) : null;
    }
  }

  ngOnDestroy(): void {
    this.releaseMeta?.();
    clearTimeout(this.toastTimer);
  }

  // ----- ACCIONES --------------------

  /**
   * Comparte la ficha. Port del `_ShareButton` de la app, con su texto: el
   * enlace en su propia línea y al final, que es lo que WhatsApp y Mensajes
   * convierten en enlace y en vista previa. Va solo en `text` y no también
   * en `url`: con los dos, algunas apps pegaban el enlace dos veces.
   *
   * Sin hoja de compartir (casi todo escritorio) se copia y se dice.
   */
  async share(): Promise<void> {
    const business = this.business;
    if (!business) {
      return;
    }
    const link = `${location.origin}/negocio/${businessSlug(business)}`;
    const text = business.city
      ? `Mira ${business.name} en ${business.city} y pide cita con Bipsy:\n${link}`
      : `Mira ${business.name} y pide cita con Bipsy:\n${link}`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        // Cerrar la hoja sin elegir no es un error que haya que contar.
        if ((error as DOMException)?.name === 'AbortError') {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Enlace copiado');
    } catch {
      this.showToast('No se ha podido copiar el enlace');
    }
  }

  private showToast(message: string, isError = false): void {
    clearTimeout(this.toastTimer);
    this.toast = message;
    this.toastIsError = isError;
    // Un fallo se lee más despacio que un «hecho»: se queda más tiempo.
    this.toastTimer = setTimeout(() => (this.toast = null), isError ? 4000 : 2400);
  }

  // ----- REPORTAR --------------------

  /** Abre la hoja de reportar, o manda a entrar y vuelve aquí después. */
  openReport(): void {
    if (!this.session.isAuthenticated) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    this.reportOpen = true;
  }

  onReportSent(): void {
    this.reportOpen = false;
    this.showToast('Reporte enviado. Gracias por ayudarnos a mejorar.');
  }

  /** Escape cierra la hoja del horario; la de reportar se cierra sola. */
  /**
   * El foco entra en la hoja del horario al abrirse: con él detrás, Escape y
   * el tabulador seguían recorriendo la ficha. Al cerrarse vuelve al botón.
   */
  @ViewChild('scheduleSheet') set scheduleSheetRef(ref: ElementRef<HTMLElement> | undefined) {
    if (ref) {
      this.scheduleOpener = document.activeElement as HTMLElement | null;
      ref.nativeElement.focus();
    } else {
      this.scheduleOpener?.focus?.();
      this.scheduleOpener = null;
    }
  }
  private scheduleOpener: HTMLElement | null = null;

  onScheduleSheetKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.scheduleSheetOpen = false;
    }
  }

  /** Mismo trato que la hoja del horario: el foco entra, y vuelve al cerrar. */
  @ViewChild('gallerySheet') set gallerySheetRef(ref: ElementRef<HTMLElement> | undefined) {
    if (ref) {
      this.galleryOpener = document.activeElement as HTMLElement | null;
      ref.nativeElement.focus();
    } else if (this.viewerIndex === null) {
      // Si se cerró para abrir el visor, el foco lo gestiona el visor.
      this.galleryOpener?.focus?.();
      this.galleryOpener = null;
    }
  }
  private galleryOpener: HTMLElement | null = null;

  onGallerySheetKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.galleryOpen = false;
    }
  }

  /** Desde la rejilla, la foto se amplía en el visor y la hoja se cierra debajo. */
  openFromGallery(index: number): void {
    this.viewerIndex = index;
    this.galleryOpen = false;
  }

  /** El precio más bajo del catálogo, para el «desde» de la barra lateral. */
  get fromPrice(): string {
    const prices = this.services.map(s => s.price).filter(p => p > 0);
    return prices.length ? euros(Math.min(...prices)) : '';
  }

  goBack(): void {
    this.location.back();
  }

  async book(service?: ServiceResponse): Promise<void> {
    const business = this.business;
    if (!business) {
      return;
    }
    // El tope se mira ANTES de entrar, no al confirmar. El servidor lo
    // comprueba igual —es su regla—, pero enterarse después de elegir
    // servicio, profesional, día y hora es perder el viaje entero por algo que
    // se sabía desde el principio.
    if (!(await this.fitsAnotherBooking(business))) {
      return;
    }
    this.router.navigate(businessBookingPath(business), {
      queryParams: service ? { serviceId: service.id } : {},
    });
  }

  /**
   * Las citas del cliente, solo si hay sesión y el negocio tiene tope: es lo
   * único para lo que hacen falta aquí. En segundo plano, para que el clic en
   * «Pedir cita» no tenga que esperarlas.
   */
  private prefetchMyBookings(generation: number): void {
    const business = this.business;
    if (!business?.bookingLimitEnabled || !this.session.isAuthenticated) {
      return;
    }
    this.bookings.mine().then(
      list => {
        if (generation === this.loadGeneration) this.myBookings = list;
      },
      () => { /* Sin la lista se deja pasar; el servidor decide. */ },
    );
  }

  /**
   * Si el cliente puede pedir otra cita aquí. Port de `_cabeOtraCita`.
   *
   * Cuenta solo las futuras y activas, que es lo que cuenta el servidor: una
   * cita a la que ya fuiste no te ocupa un sitio. Ante la duda —sin sesión o
   * sin la lista todavía— deja pasar: mejor que lo rechace el servidor que
   * bloquear a quien sí podía.
   */
  private async fitsAnotherBooking(business: BusinessResponse): Promise<boolean> {
    const limit = business.bookingLimitPerCustomer;
    if (!business.bookingLimitEnabled || !limit || limit <= 0 || !this.myBookings) {
      return true;
    }
    const now = Date.now();
    const pending = this.myBookings.filter(b =>
      b.businessId === business.id &&
      (isBookingActive(b) || isAwaitingCustomer(b)) &&
      parseLocal(b.startDateTime).getTime() > now,
    ).length;
    if (pending < limit) {
      return true;
    }
    const goToBookings = await this.dialog.confirm({
      title: `Ya tienes ${pending} ${pending === 1 ? 'cita' : 'citas'} aquí`,
      message: limit === 1
        ? 'Este negocio permite una cita pendiente por cliente. Cancela la que tienes o espera a que pase para pedir otra.'
        : `Este negocio permite ${limit} citas pendientes por cliente. Cancela alguna o espera a que pase para pedir otra.`,
      // La app solo informa; aquí, ya que hay que cancelar una, se ofrece el
      // camino hasta ellas.
      confirmLabel: 'Ver mis citas',
      cancelLabel: 'Entendido',
    });
    if (goToBookings) {
      this.router.navigate(['/citas']);
    }
    return false;
  }

  /**
   * Llamar pregunta antes, como en la app: en el móvil el `tel:` marca al
   * momento, y un toque sin querer en el icono era una llamada a un negocio.
   */
  async callPhone(event: Event): Promise<void> {
    const phone = this.business?.phone;
    if (!phone) {
      return;
    }
    event.preventDefault();
    const call = await this.dialog.confirm({
      title: '¿Llamar a este negocio?',
      message: phone,
      confirmLabel: 'Llamar',
    });
    if (call) {
      window.location.href = `tel:${phone.replace(/\s/g, '')}`;
    }
  }

  // ----- GALERÍA --------------------

  get viewerImages(): PortfolioViewerImage[] {
    return this.portfolio.map(item => ({
      id: item.id,
      url: this.portfolioUrl(item),
      caption: item.caption?.trim() || undefined,
      serviceName: item.serviceName || undefined,
    }));
  }

  openViewer(index: number): void {
    this.viewerIndex = index;
  }

  /**
   * Abre el hilo con el negocio. Es idempotente: si ya existe devuelve el
   * mismo, así que no hace falta comprobar antes si hay conversación.
   */
  async openChat(): Promise<void> {
    if (!this.business) {
      return;
    }
    if (!this.session.isAuthenticated) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    this.chatBusy = true;
    try {
      const conversation = await this.chat.openWithBusiness(this.business.id);
      this.router.navigate(['/mensajes', conversation.id]);
    } catch (raw) {
      // En aviso flotante y no bajo el botón: en el móvil se escribe desde la
      // fila de acciones de arriba y la barra lateral queda al fondo, así que
      // un error pintado allí no lo veía nadie. El 403 ya explica qué falta.
      this.showToast(ApiError.from(raw).message, true);
    } finally {
      this.chatBusy = false;
    }
  }

  async toggleFavorite(): Promise<void> {
    if (!this.business || this.favoriteBusy) {
      return;
    }
    if (!this.session.isAuthenticated) {
      this.router.navigate(['/acceder'], { queryParams: { returnTo: this.router.url } });
      return;
    }
    this.favoriteBusy = true;
    try {
      this.isFavorite = await this.bipsy.toggleFavorite(this.business.id);
    } catch {
      // Un favorito que no se guarda no puede romper la ficha. El estado se
      // queda como estaba y se vuelve a intentar al siguiente clic.
    } finally {
      this.favoriteBusy = false;
    }
  }
}

function valueOr<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function trim(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}
