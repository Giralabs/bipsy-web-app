import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiService } from './api.service';
import { SocialAuthService } from './social-auth.service';
import { TokenStorageService } from './token-storage.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MeRepository } from '../repositories/me.repository';
import { CustomerProfile, LoginRequest, MeResponse, UserProfileDto } from '../models/bipsy.models';
import { fixImageUrl } from '../shared/image-url';

/** Dónde está la sesión. `unknown` mientras se comprueba al arrancar. */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/**
 * Estado de sesión de la web. Equivalente al `AuthController` de la app.
 *
 * Es el único sitio que decide si hay sesión. Antes cada pantalla miraba el
 * `localStorage` por su cuenta y `fetchMe()` devolvía un usuario de demo
 * cuando fallaba, así que la web se comportaba como si hubiera sesión sin
 * haberla: el perfil enseñaba a "Miguel Torres" y reservar daba 401.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);
  private readonly auth = inject(AuthRepository);
  private readonly meRepo = inject(MeRepository);
  private readonly social = inject(SocialAuthService);

  private readonly statusSubject = new BehaviorSubject<SessionStatus>('unknown');
  readonly status$ = this.statusSubject.asObservable();

  private readonly userSubject = new BehaviorSubject<UserProfileDto | null>(null);
  readonly currentUser$ = this.userSubject.asObservable();

  private readonly favoritesSubject = new BehaviorSubject<number[]>([]);
  readonly favoriteBusinessIds$ = this.favoritesSubject.asObservable();

  /** Modal de acceso. Lo abre cualquier acción que exija sesión. */
  private readonly authModalSubject = new BehaviorSubject<boolean>(false);
  readonly isAuthModalOpen$ = this.authModalSubject.asObservable();

  /** A dónde volver cuando termine de entrar. */
  private pendingReturnTo: string | null = null;

  constructor() {
    // El refresco ha fallado: la sesión ya no existe y la UI tiene que
    // enterarse aunque nadie estuviera mirando esa petición.
    this.api.sessionExpired$.subscribe(() => this.clearSession());
    void this.restore();
  }

  get isAuthenticated(): boolean {
    return this.statusSubject.value === 'authenticated';
  }

  get currentUser(): UserProfileDto | null {
    return this.userSubject.value;
  }

  /**
   * Hay un token guardado, aunque todavía no se sepa si vale.
   *
   * Sirve para no echar a nadie de una pantalla protegida durante el instante
   * en que la sesión aún se está comprobando: sin esto, recargar `/citas`
   * con sesión válida rebotaba al login antes de que llegara `/me`.
   */
  get tokenLooksPresent(): boolean {
    return this.tokens.hasSession;
  }

  /** Comprueba al arrancar si el token guardado sigue valiendo. */
  async restore(): Promise<void> {
    if (!this.tokens.hasSession) {
      this.statusSubject.next('anonymous');
      return;
    }
    try {
      await this.refreshProfile();
      this.statusSubject.next('authenticated');
    } catch {
      // Un token que ya no vale es un token que sobra. Sin esto la web se
      // quedaba con la sesión "a medias": cabecera de usuario y 401 en todo.
      this.clearSession();
    }
  }

  async login(req: LoginRequest): Promise<void> {
    await this.auth.login(req);
    await this.refreshProfile();
    this.statusSubject.next('authenticated');
    this.closeAuthModal();
  }

  /** Tras el alta, la sesión ya viene abierta en la respuesta. */
  async onRegistered(): Promise<void> {
    await this.refreshProfile();
    this.statusSubject.next('authenticated');
    this.closeAuthModal();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    // Cierra también la sesión de Firebase, que es la que abren Google y
    // Apple, para que la próxima vez vuelva a preguntar la cuenta. Igual que
    // en `AuthController.logout()` de la app; no afecta a quien entró con
    // contraseña, que no tiene ninguna abierta.
    await this.social.signOut();
    this.clearSession();
  }

  /** Relee `/customers/me` — el perfil con foto y favoritos. */
  async refreshProfile(): Promise<void> {
    const me = await this.meRepo.me();
    let customer: CustomerProfile | null = null;
    if (me.role === 'CUSTOMER') {
      customer = await this.meRepo.customer();
      this.favoritesSubject.next(customer.favoriteBusinessIds ?? []);
    }
    this.userSubject.next(toUserProfile(me, customer));
  }

  /** El perfil ya actualizado que devuelven añadir y quitar favorito. */
  applyCustomer(customer: CustomerProfile): void {
    this.favoritesSubject.next(customer.favoriteBusinessIds ?? []);
    const current = this.userSubject.value;
    this.userSubject.next({
      ...(current ?? {}),
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      profileImageUrl: fixImageUrl(customer.profileImageUrl) ?? undefined,
      initials: initialsOf(customer.name),
      role: current?.role ?? 'CUSTOMER',
    });
  }

  isFavorite(businessId: number): boolean {
    return this.favoritesSubject.value.includes(businessId);
  }

  // ----- MODAL DE ACCESO --------------------

  /**
   * Pide sesión antes de seguir. [returnTo] es a dónde llevar después: sin
   * eso, quien pulsa "Reservar" sin sesión acaba en la portada y tiene que
   * volver a buscar el negocio.
   */
  requireAuth(returnTo?: string): boolean {
    if (this.isAuthenticated) {
      return true;
    }
    this.pendingReturnTo = returnTo ?? null;
    this.authModalSubject.next(true);
    return false;
  }

  openAuthModal(returnTo?: string): void {
    this.pendingReturnTo = returnTo ?? null;
    this.authModalSubject.next(true);
  }

  closeAuthModal(): void {
    this.authModalSubject.next(false);
  }

  takeReturnTo(): string | null {
    const value = this.pendingReturnTo;
    this.pendingReturnTo = null;
    return value;
  }

  private clearSession(): void {
    this.tokens.clear();
    this.userSubject.next(null);
    this.favoritesSubject.next([]);
    this.statusSubject.next('anonymous');
  }
}

function toUserProfile(me: MeResponse, customer: CustomerProfile | null): UserProfileDto {
  const name = customer?.name ?? me.name;
  return {
    id: customer?.id ?? me.id,
    name,
    email: customer?.email ?? me.email,
    username: customer?.username ?? me.username,
    phone: customer?.phone ?? me.phone,
    role: me.role,
    // Llega relativa a la API: normalizada aquí, la barra, los ajustes y la
    // hoja de la foto usan todos la misma URL.
    profileImageUrl: fixImageUrl(customer?.profileImageUrl) ?? undefined,
    city: customer?.city,
    province: customer?.province,
    initials: initialsOf(name),
    // Sin esto, la web ofrecía cambiar la contraseña a quien entró con Google
    // y no tiene ninguna: el servidor responde 400 y el usuario no entiende
    // por qué le rechazan algo que la propia pantalla le ofrecía.
    hasPassword: me.hasPassword ?? me.authProvider !== 'GOOGLE',
    authProvider: me.authProvider,
  };
}

/** Dos letras. Con un solo nombre, sus dos primeras. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0] ?? '').slice(0, 2).toUpperCase();
}
