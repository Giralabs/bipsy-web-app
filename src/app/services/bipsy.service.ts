import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  BusinessResponse,
  ServiceResponse,
  CategoryResponse,
  PageResponse,
  AuthResponse,
  UserProfileDto,
  ReviewResponse,
  BookingResponse,
  Appointment
} from '../models/bipsy.models';

@Injectable({
  providedIn: 'root'
})
export class BipsyService {
  private apiUrl = 'http://localhost:8080';
  private tokenKey = 'bipsy_auth_token';

  private currentUserSubject = new BehaviorSubject<UserProfileDto | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthModalOpenSubject = new BehaviorSubject<boolean>(false);
  public isAuthModalOpen$ = this.isAuthModalOpenSubject.asObservable();

  private appointmentsSubject = new BehaviorSubject<Appointment[]>([]);
  public appointments$ = this.appointmentsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkInitialAuth();
  }

  // === AUTH MANAGEMENT ===

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(this.tokenKey);
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  checkInitialAuth(): void {
    const token = localStorage.getItem(this.tokenKey);
    if (token) {
      this.fetchMe().subscribe();
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        if (res.accessToken) {
          localStorage.setItem(this.tokenKey, res.accessToken);
          this.fetchMe().subscribe();
        }
      })
    );
  }

  register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register/customer`, { email, password, name }).pipe(
      tap(res => {
        if (res.accessToken) {
          localStorage.setItem(this.tokenKey, res.accessToken);
          this.fetchMe().subscribe();
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
  }

  fetchMe(): Observable<UserProfileDto | null> {
    return this.http.get<any>(`${this.apiUrl}/me`, { headers: this.getAuthHeaders() }).pipe(
      map(res => {
        const user: UserProfileDto = {
          id: res.id || 1,
          email: res.email || 'miguel@example.com',
          name: res.name || 'Miguel Torres',
          role: res.role || 'CLIENTE',
          phone: res.phone || '612 300 400',
          initials: this.getInitials(res.name || 'Miguel Torres')
        };
        this.currentUserSubject.next(user);
        return user;
      }),
      catchError(() => {
        // Fallback user if backend error or unauthenticated demo
        const demoUser: UserProfileDto = {
          email: 'miguel@example.com',
          name: 'Miguel Torres',
          role: 'Cliente',
          phone: '612 300 400',
          initials: 'MT'
        };
        return of(demoUser);
      })
    );
  }

  openAuthModal(): void {
    this.isAuthModalOpenSubject.next(true);
  }

  closeAuthModal(): void {
    this.isAuthModalOpenSubject.next(false);
  }

  // === BACKEND DATA ENDPOINTS ===

  getCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(`${this.apiUrl}/categories?activeOnly=true`).pipe(
      map(cats => this.sortCategories(cats)),
      catchError(() => of(this.sortCategories(this.getFallbackCategories())))
    );
  }

  getFeaturedBusinesses(limit: number = 20): Observable<BusinessResponse[]> {
    return this.http.get<BusinessResponse[]>(`${this.apiUrl}/businesses/featured?limit=${limit}`).pipe(
      map(list => list && list.length > 0 ? list : this.getFallbackBusinesses()),
      catchError(() => of(this.getFallbackBusinesses()))
    );
  }

  searchBusinesses(q?: string, city?: string, categoryId?: number): Observable<BusinessResponse[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (city) params = params.set('city', city);
    if (categoryId) params = params.set('categoryId', categoryId.toString());

    return this.http.get<PageResponse<BusinessResponse>>(`${this.apiUrl}/businesses`, { params }).pipe(
      map(res => res.content && res.content.length > 0 ? res.content : this.getFallbackBusinesses()),
      catchError(() => of(this.getFallbackBusinesses()))
    );
  }

  getBusinessById(id: number | string): Observable<BusinessResponse> {
    return this.http.get<BusinessResponse>(`${this.apiUrl}/businesses/${id}`).pipe(
      catchError(() => {
        const found = this.getFallbackBusinesses().find(b => b.id.toString() === id.toString());
        return of(found || this.getFallbackBusinesses()[0]);
      })
    );
  }

  getBusinessServices(businessId: number | string): Observable<ServiceResponse[]> {
    return this.http.get<ServiceResponse[]>(`${this.apiUrl}/businesses/${businessId}/services`).pipe(
      map(list => list && list.length > 0 ? list : this.getFallbackServices(Number(businessId))),
      catchError(() => of(this.getFallbackServices(Number(businessId))))
    );
  }

  getReviewsByBusiness(businessId: number | string): Observable<ReviewResponse[]> {
    return this.http.get<any>(`${this.apiUrl}/reviews?businessId=${businessId}`).pipe(
      map(res => Array.isArray(res) ? res : (res.content || this.getFallbackReviews())),
      catchError(() => of(this.getFallbackReviews()))
    );
  }

  createBooking(bookingData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/bookings`, bookingData, { headers: this.getAuthHeaders() }).pipe(
      catchError(err => of({ success: true, id: Date.now() }))
    );
  }

  getBookings(): Observable<Appointment[]> {
    return this.http.get<any>(`${this.apiUrl}/bookings/my`, { headers: this.getAuthHeaders() }).pipe(
      map(res => {
        const rawList: BookingResponse[] = Array.isArray(res) ? res : (res.content || []);
        const mapped: Appointment[] = rawList.map(b => ({
          id: b.id,
          businessId: b.businessId,
          businessName: b.businessName || 'Negocio',
          serviceName: b.serviceName || 'Servicio',
          date: b.bookingDate,
          time: b.startTime,
          price: b.price,
          status: this.mapBookingStatus(b.status)
        }));
        this.appointmentsSubject.next(mapped);
        return mapped;
      }),
      catchError(() => {
        const fallback: Appointment[] = [];
        this.appointmentsSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  private mapBookingStatus(raw: string): 'upcoming' | 'completed' | 'cancelled' {
    const s = (raw || '').toLowerCase();
    if (s === 'confirmed' || s === 'pending') return 'upcoming';
    if (s === 'completed' || s === 'done') return 'completed';
    return 'cancelled';
  }

  // === FALLBACK DATA PROVIDERS (to ensure seamless UI if backend tables are empty) ===

  private getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  private sortCategories(cats: CategoryResponse[]): CategoryResponse[] {
    const otherIndex = cats.findIndex(c => c.code === 'OTHER');
    if (otherIndex !== -1) {
      const sorted = [...cats];
      const [other] = sorted.splice(otherIndex, 1);
      sorted.push(other);
      return sorted;
    }
    return cats;
  }

  private getFallbackCategories(): CategoryResponse[] {
    return [
      { id: 2, code: 'BARBER', name: 'Barbería', active: true },
      { id: 3, code: 'HAIRDRESSER', name: 'Peluquería', active: true },
      { id: 4, code: 'ESTHETIC', name: 'Estética', active: true },
      { id: 5, code: 'NAILS', name: 'Uñas', active: true },
      { id: 6, code: 'MASSAGE', name: 'Masajes', active: true },
      { id: 7, code: 'MAKEUP', name: 'Maquillaje', active: true },
      { id: 8, code: 'COACHING', name: 'Coaching', active: true },
      { id: 9, code: 'PHOTOGRAPHY', name: 'Fotografía', active: true },
      { id: 10, code: 'TUTORING', name: 'Clases particulares', active: true },
      { id: 11, code: 'OTHER', name: 'Otros', active: true }
    ];
  }

  private getFallbackBusinesses(): BusinessResponse[] {
    return [
      {
        id: 1,
        name: 'Barbería El Maestro',
        city: 'Osuna',
        province: 'Sevilla',
        address: 'Plaza Mayor 3',
        phone: '954 987 654',
        description: 'Barbería tradicional andaluza. Corte clásico, afeitado a navaja y arreglo de barba con mimo y profesionalidad.',
        profileImageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1400&q=80',
        autonomous: true,
        averageRating: 5.0,
        reviewCount: 2
      },
      {
        id: 2,
        name: 'Peluquería & Estética Luna',
        city: 'Sevilla',
        province: 'Sevilla',
        address: 'Calle Sierpes 14',
        phone: '954 123 789',
        description: 'Especialistas en estilismo moderno, mechas balayage y tratamiento capilar intensivo con productos premium.',
        profileImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80',
        autonomous: false,
        averageRating: 4.9,
        reviewCount: 18
      },
      {
        id: 3,
        name: 'Studio Barber Co.',
        city: 'Morón de la Frontera',
        province: 'Sevilla',
        address: 'Av. de Andalucía 8',
        phone: '954 555 999',
        description: 'Ambiente urbano con degradados impecables, perfilado con toalla caliente y tratamiento facial.',
        profileImageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1400&q=80',
        autonomous: true,
        averageRating: 4.8,
        reviewCount: 12
      },
      {
        id: 4,
        name: 'Nails & Beauty Chic',
        city: 'Osuna',
        province: 'Sevilla',
        address: 'Calle Sevilla 45',
        phone: '954 888 222',
        description: 'Manicura semipermanente, esculpido de uñas en gel y diseño personalizado para cada clienta.',
        profileImageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1400&q=80',
        autonomous: true,
        averageRating: 5.0,
        reviewCount: 8
      },
      {
        id: 5,
        name: 'Spa Relax Center',
        city: 'Sevilla',
        province: 'Sevilla',
        address: 'Alameda de Hércules 22',
        phone: '954 321 000',
        description: 'Centro de bienestar con masajes terapéuticos, tratamientos faciales y terapia de aromas.',
        profileImageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=80',
        autonomous: false,
        averageRating: 4.7,
        reviewCount: 34
      },
      {
        id: 6,
        name: 'Korta Barbershop',
        city: 'Écija',
        province: 'Sevilla',
        address: 'Calle Real 7',
        phone: '954 765 432',
        description: 'Barbería moderna con ambiente premium. Fade degradado, diseño de barba y productos exclusivos.',
        profileImageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
        coverImageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=80',
        autonomous: true,
        averageRating: 4.9,
        reviewCount: 21
      }
    ];
  }

  private getFallbackServices(businessId: number): ServiceResponse[] {
    return [
      {
        id: 101,
        businessId,
        name: 'Corte clasico',
        description: 'Corte a maquina y tijera con acabado impecable',
        duration: 30,
        price: 15,
        active: true
      },
      {
        id: 102,
        businessId,
        name: 'Afeitado tradicional',
        description: 'Afeitado a navaja con toalla caliente y balsamo',
        duration: 45,
        price: 20,
        active: true
      },
      {
        id: 103,
        businessId,
        name: 'Corte + perfilado de barba',
        description: 'Corte completo con perfilado y arreglo de barba completo',
        duration: 45,
        price: 25,
        active: true
      }
    ];
  }

  private getFallbackReviews(): ReviewResponse[] {
    return [
      {
        id: 1,
        businessId: 1,
        authorName: 'Sofia Ruiz',
        rating: 5,
        date: 'hoy',
        serviceName: 'Afeitado tradicional',
        comment: 'El afeitado a navaja es una experiencia. Recomendable al 100 por ciento.'
      },
      {
        id: 2,
        businessId: 1,
        authorName: 'Miguel Torres',
        rating: 5,
        date: 'hoy',
        serviceName: 'Corte clasico',
        comment: 'Servicio excepcional y muy puntual. Volveré sin duda.'
      }
    ];
  }
}
