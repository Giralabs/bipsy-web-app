import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import {
  AvailabilityResponse,
  BusinessPolicyGroup,
  BusinessResponse,
  CategoryResponse,
  PageResponse,
  PortfolioItem,
  ReviewResponse,
  ScheduleDayResponse,
  ServiceResponse,
  WorkerResponse,
} from '../models/bipsy.models';

export interface BusinessSearchQuery {
  q?: string;
  city?: string;
  categoryId?: number;
  /** `yyyy-MM-dd`: deja solo los que abren ese día de la semana. */
  availableOn?: string;
  /**
   * El punto se manda siempre que se sepa. **Con radio** acota la búsqueda a
   * esa zona; **sin él**, solo sirve para ordenar: el servidor reparte los
   * resultados por franjas de kilómetros igual que la fila de destacados.
   */
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  size?: number;
  sort?: string;
}

/**
 * Lo público del catálogo: categorías, negocios, servicios, disponibilidad,
 * reseñas, horario, políticas y galería.
 *
 * Son las rutas que no exigen sesión, así que se piden con `auth: false`: con
 * un token caducado en el navegador, mandarlo provocaba un 401 y un refresco
 * inútil solo por mirar la portada.
 */
@Injectable({ providedIn: 'root' })
export class CatalogRepository {
  private readonly api = inject(ApiService);

  // ----- CATEGORÍAS --------------------

  async categories(): Promise<CategoryResponse[]> {
    const list = await this.api.get<CategoryResponse[]>('/categories', { activeOnly: true }, false);
    return sortWithOtherLast(list ?? []);
  }

  // ----- NEGOCIOS --------------------

  /**
   * Destacados: plan Quality o méritos propios. Público.
   *
   * **El orden lo decide el servidor** y aquí no se retoca: con coordenadas los
   * agrupa en franjas de distancia y pone delante de cada franja a los de plan
   * Quality. Se mandan si se tienen, no se exigen: la fila tiene que salir
   * igual con la ubicación denegada.
   */
  featured(page = 0, size = 12, coords?: { lat: number; lng: number }): Promise<BusinessResponse[]> {
    return this.api.get<BusinessResponse[]>(
      '/businesses/featured',
      { page, size, lat: coords?.lat, lng: coords?.lng },
      false,
    );
  }

  /** Lo que el cliente ha guardado, del último marcado al primero. */
  favorites(page = 0, size = 12): Promise<BusinessResponse[]> {
    return this.api.get<BusinessResponse[]>('/businesses/favorites', { page, size });
  }

  /**
   * Donde ya ha reservado, de la reserva más reciente a la más antigua.
   *
   * Un negocio puede salir también en favoritos: son dos preguntas distintas
   * —"los que he guardado" y "dónde suelo ir"— y esconderlo de una para no
   * repetir descolocaría el orden de la otra.
   */
  rebookable(page = 0, size = 12): Promise<BusinessResponse[]> {
    return this.api.get<BusinessResponse[]>('/businesses/rebook', { page, size });
  }

  searchBusinesses(query: BusinessSearchQuery): Promise<PageResponse<BusinessResponse>> {
    return this.api.get<PageResponse<BusinessResponse>>('/businesses', { ...query }, false);
  }

  business(id: number | string): Promise<BusinessResponse> {
    return this.api.get<BusinessResponse>(`/businesses/${id}`, undefined, false);
  }

  businessBySlug(slug: string): Promise<BusinessResponse> {
    return this.api.get<BusinessResponse>(
      `/businesses/by-slug/${encodeURIComponent(slug)}`, undefined, false);
  }

  businessServices(id: number | string): Promise<ServiceResponse[]> {
    return this.api.get<ServiceResponse[]>(`/businesses/${id}/services`, undefined, false);
  }

  businessWorkers(id: number | string): Promise<WorkerResponse[]> {
    return this.api.get<WorkerResponse[]>(`/businesses/${id}/workers`, undefined, false);
  }

  businessSchedule(id: number | string): Promise<ScheduleDayResponse[]> {
    return this.api.get<ScheduleDayResponse[]>(`/businesses/${id}/schedule`, undefined, false);
  }

  businessPolicies(id: number | string): Promise<BusinessPolicyGroup[]> {
    return this.api.get<BusinessPolicyGroup[]>(`/businesses/${id}/policies`, undefined, false);
  }

  businessPortfolio(id: number | string): Promise<PortfolioItem[]> {
    return this.api.get<PortfolioItem[]>(`/businesses/${id}/portfolio`, undefined, false);
  }

  // ----- DISPONIBILIDAD --------------------

  /**
   * Huecos de un servicio en un día. `workerId` es opcional: sin él, el
   * servidor devuelve los huecos de cualquier profesional y dice en
   * `availableWorkerIds` quién puede con cada uno.
   */
  async availability(
    serviceId: number,
    date: string,
    workerId?: number,
  ): Promise<AvailabilityResponse> {
    const res = await this.api.get<AvailabilityResponse>(
      `/services/${serviceId}/availability`,
      { date, workerId },
      false,
    );
    // El backend manda "HH:mm:ss"; en pantalla los segundos sobran y hacen
    // que dos horas iguales no se comparen iguales.
    return {
      ...res,
      slots: (res.slots ?? []).map(slot => ({
        ...slot,
        start: trimSeconds(slot.start),
        end: trimSeconds(slot.end),
      })),
    };
  }

  // ----- RESEÑAS --------------------

  /** La ruta es `/reviews/business/{id}`, no `/reviews?businessId=`. */
  reviewsByBusiness(businessId: number | string, page = 0, size = 10): Promise<PageResponse<ReviewResponse>> {
    return this.api.get<PageResponse<ReviewResponse>>(
      `/reviews/business/${businessId}`,
      { page, size },
      false,
    );
  }
}

/** "Otros" siempre al final: es el cajón de sastre, no una categoría más. */
function sortWithOtherLast(categories: CategoryResponse[]): CategoryResponse[] {
  const index = categories.findIndex(c => c.code === 'OTHER');
  if (index === -1) {
    return categories;
  }
  const sorted = [...categories];
  const [other] = sorted.splice(index, 1);
  sorted.push(other);
  return sorted;
}

function trimSeconds(value: string): string {
  return value && value.length >= 5 ? value.slice(0, 5) : value;
}
