import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { ApiError } from '../core/api-error';
import { SessionService } from '../core/session.service';
import { BookingRepository } from '../repositories/booking.repository';
import { BusinessSearchQuery, CatalogRepository } from '../repositories/catalog.repository';
import { MeRepository } from '../repositories/me.repository';
import {
  AvailabilityResponse,
  BookingResponse,
  BusinessResponse,
  CategoryResponse,
  CreateBookingRequest,
  ReviewResponse,
  ScheduleDayResponse,
  ServiceResponse,
  WorkerResponse,
} from '../models/bipsy.models';
import { DEMO_BUSINESSES, DEMO_CATEGORIES, DEMO_REVIEWS, DEMO_SERVICES } from './demo-data';

/**
 * Fachada de datos de la web. La usan las páginas; por debajo son los
 * repositorios, igual que en la app.
 *
 * **Los datos de demostración solo existen en desarrollo y solo si la
 * petición no llegó a salir.** Antes cada llamada tenía un `catchError` que
 * devolvía negocios inventados, así que un backend caído o un endpoint mal
 * escrito se veían exactamente igual que uno que funciona: la web enseñaba
 * seis barberías que no existen y nadie se enteraba de que la API estaba rota.
 * Ahora en producción el error sube a la pantalla, que lo cuenta y ofrece
 * reintentar, como hace la app.
 */
@Injectable({ providedIn: 'root' })
export class BipsyService {
  private readonly catalog = inject(CatalogRepository);
  private readonly bookings = inject(BookingRepository);
  private readonly meRepo = inject(MeRepository);
  private readonly session = inject(SessionService);

  // Reexpuestos para que las páginas no tengan que inyectar dos servicios.
  readonly currentUser$ = this.session.currentUser$;
  readonly isAuthModalOpen$ = this.session.isAuthModalOpen$;

  // ----- CATÁLOGO --------------------

  async getCategories(): Promise<CategoryResponse[]> {
    try {
      return await this.catalog.categories();
    } catch (error) {
      return this.orDemo(error, DEMO_CATEGORIES);
    }
  }

  async getFeaturedBusinesses(size = 12, coords?: { lat: number; lng: number }): Promise<BusinessResponse[]> {
    try {
      return await this.catalog.featured(0, size, coords);
    } catch (error) {
      return this.orDemo(error, DEMO_BUSINESSES);
    }
  }

  /**
   * Las dos filas personales de Explorar. Sin sesión devuelven vacío en vez de
   * llamar: los endpoints exigen cliente autenticado y un 401 en la portada
   * dispararía el refresco de token de alguien que simplemente no ha entrado.
   */
  async getFavoriteBusinesses(): Promise<BusinessResponse[]> {
    if (!this.session.isAuthenticated) {
      return [];
    }
    try {
      return await this.catalog.favorites();
    } catch {
      return [];
    }
  }

  async getRebookableBusinesses(): Promise<BusinessResponse[]> {
    if (!this.session.isAuthenticated) {
      return [];
    }
    try {
      return await this.catalog.rebookable();
    } catch {
      return [];
    }
  }

  /**
   * Una página amplia del catálogo para las filas que se calculan en la web
   * (mejor valorados, recién abiertos). El servidor no ordena la búsqueda por
   * `sort`, así que se ordena aquí. Si falla, esas filas simplemente no salen.
   */
  async getCatalogSample(size = 60, coords?: { lat: number; lng: number }): Promise<BusinessResponse[]> {
    try {
      const page = await this.catalog.searchBusinesses({ size, lat: coords?.lat, lng: coords?.lng });
      return page.content ?? [];
    } catch {
      return [];
    }
  }

  async searchBusinesses(query: BusinessSearchQuery): Promise<BusinessResponse[]> {
    try {
      const page = await this.catalog.searchBusinesses({ size: 40, ...query });
      return page.content ?? [];
    } catch (error) {
      return this.orDemo(error, DEMO_BUSINESSES);
    }
  }

  async getBusinessById(id: number | string): Promise<BusinessResponse> {
    try {
      return await this.catalog.business(id);
    } catch (error) {
      const demo = DEMO_BUSINESSES.find(b => String(b.id) === String(id)) ?? DEMO_BUSINESSES[0];
      return this.orDemo(error, demo);
    }
  }

  async getBusinessServices(businessId: number | string): Promise<ServiceResponse[]> {
    try {
      return await this.catalog.businessServices(businessId);
    } catch (error) {
      return this.orDemo(error, DEMO_SERVICES(Number(businessId)));
    }
  }

  async getBusinessWorkers(businessId: number | string): Promise<WorkerResponse[]> {
    return this.catalog.businessWorkers(businessId);
  }

  async getBusinessSchedule(businessId: number | string): Promise<ScheduleDayResponse[]> {
    return this.catalog.businessSchedule(businessId);
  }

  async getReviewsByBusiness(businessId: number | string): Promise<ReviewResponse[]> {
    try {
      const page = await this.catalog.reviewsByBusiness(businessId);
      return page.content ?? [];
    } catch (error) {
      return this.orDemo(error, DEMO_REVIEWS);
    }
  }

  getAvailability(serviceId: number, date: string, workerId?: number): Promise<AvailabilityResponse> {
    return this.catalog.availability(serviceId, date, workerId);
  }

  // ----- CITAS --------------------

  createBooking(req: CreateBookingRequest): Promise<BookingResponse> {
    return this.bookings.create(req);
  }

  getMyBookings(): Promise<BookingResponse[]> {
    return this.bookings.mine();
  }

  cancelBooking(id: number, reason?: string): Promise<BookingResponse> {
    return this.bookings.cancel(id, reason);
  }

  // ----- FAVORITOS --------------------

  async toggleFavorite(businessId: number): Promise<boolean> {
    const wasFavorite = this.session.isFavorite(businessId);
    const customer = wasFavorite
      ? await this.meRepo.removeFavoriteBusiness(businessId)
      : await this.meRepo.addFavoriteBusiness(businessId);
    this.session.applyCustomer(customer);
    return !wasFavorite;
  }

  /**
   * Devuelve los datos de demostración solo si estamos en desarrollo y el
   * fallo fue de red. Un 404 o un 500 son errores de verdad y suben.
   */
  private orDemo<T>(error: unknown, demo: T): T {
    const apiError = ApiError.from(error);
    if (!environment.production && apiError.networkError) {
      console.warn(
        '[Bipsy] Backend no disponible: se están pintando datos de demostración. ' +
        'Arranca bipsy-backend para ver los reales.',
      );
      return demo;
    }
    throw apiError;
  }
}
