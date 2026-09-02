import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { BipsyService } from '../../services/bipsy.service';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { ChatRepository } from '../../repositories/chat.repository';
import {
  BusinessPolicyGroup,
  BusinessResponse,
  PortfolioItem,
  ReviewResponse,
  ScheduleDayResponse,
  ServiceResponse,
  businessLocationDisplay,
  chargesCancellation,
  primaryCategory,
} from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { duration, euros } from '../../shared/dates';
import { fixImageUrl, placeholderImage } from '../../shared/image-url';
import { businessBookingPath, businessIdFromParam } from '../../shared/slug';

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
 * El orden es el de la app: portada, cabecera, políticas, galería, servicios y
 * reseñas. Las políticas van en posición fija entre la cabecera y el resto —es
 * lo que el cliente necesita para decidir (cita previa, accesibilidad,
 * alergias), no escaparate— y por eso no se mueven.
 */
@Component({
  selector: 'app-business-detail',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './business-detail.component.html',
  styleUrl: './business-detail.component.css',
})
export class BusinessDetailComponent implements OnInit {
  private readonly bipsy = inject(BipsyService);
  private readonly catalog = inject(CatalogRepository);
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  business?: BusinessResponse;
  services: ServiceResponse[] = [];
  reviews: ReviewResponse[] = [];
  policies: BusinessPolicyGroup[] = [];
  portfolio: PortfolioItem[] = [];
  schedule: ScheduleDayResponse[] = [];

  isLoading = true;
  loadError: ApiError | null = null;
  isFavorite = false;
  favoriteBusy = false;
  chatBusy = false;
  chatError: string | null = null;
  scheduleOpen = false;
  /** Enseña 5 normas como mucho: la ficha ya es larga. */
  allPoliciesOpen = false;

  ngOnInit(): void {
    this.session.favoriteBusinessIds$.subscribe(ids => {
      this.isFavorite = !!this.business && ids.includes(this.business.id);
    });

    this.route.paramMap.subscribe(params => {
      void this.load(businessIdFromParam(params.get('id')));
    });
  }

  async load(id: number | null): Promise<void> {
    if (id === null) {
      this.loadError = new ApiError(404, 'No hemos encontrado este negocio.');
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.loadError = null;
    try {
      this.business = await this.bipsy.getBusinessById(id);
      this.isFavorite = this.session.isFavorite(this.business.id);
    } catch (error) {
      this.loadError = ApiError.from(error);
      this.isLoading = false;
      return;
    }
    this.isLoading = false;

    // El resto se pide en paralelo y NINGUNO tumba la ficha: sin galería o sin
    // horario la ficha sigue sirviendo para lo que se viene, que es reservar.
    const [services, reviews, policies, portfolio, schedule] = await Promise.allSettled([
      this.bipsy.getBusinessServices(id),
      this.bipsy.getReviewsByBusiness(id),
      this.catalog.businessPolicies(id),
      this.catalog.businessPortfolio(id),
      this.catalog.businessSchedule(id),
    ]);

    this.services = valueOr(services, []).filter(s => s.active);
    this.reviews = valueOr(reviews, []);
    this.policies = valueOr(policies, []);
    this.portfolio = valueOr(portfolio, []);
    this.schedule = valueOr(schedule, []);
  }

  // ----- VISTA --------------------

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

  coverUrl(): string {
    return imageOrPlaceholder(this.business);
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
  }

  // ----- ACCIONES --------------------

  goBack(): void {
    this.location.back();
  }

  book(service?: ServiceResponse): void {
    if (!this.business) {
      return;
    }
    this.router.navigate(businessBookingPath(this.business), {
      queryParams: service ? { serviceId: service.id } : {},
    });
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
      this.chatError = ApiError.from(raw).message;
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

/** Imagen del negocio, o una de relleno estable por negocio y categoría. */
function imageOrPlaceholder(business?: BusinessResponse): string {
  if (!business) {
    return '';
  }
  return (
    fixImageUrl(business.coverImageUrl || business.profileImageUrl) ??
    placeholderImage(business.id, primaryCategory(business)?.code)
  );
}
