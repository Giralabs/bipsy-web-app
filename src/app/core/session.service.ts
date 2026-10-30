import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, filter } from 'rxjs';
import { ApiService } from './api.service';
import { ApiError } from './api-error';
import { SocialAuthService } from './social-auth.service';
import { TokenStorageService } from './token-storage.service';
import { AuthRepository } from '../repositories/auth.repository';
import { MeRepository } from '../repositories/me.repository';
import { CustomerProfile, LoginRequest, MeResponse, UserProfileDto } from '../models/bipsy.models';
import { fixImageUrl } from '../shared/image-url';

/** Dónde está la sesión. `unknown` mientras se comprueba al arrancar. */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

/** La pantalla de «verifica tu correo». */
export const EMAIL_PENDING_PATH = '/verificar-correo';

/**
 * Lo que se puede abrir aunque el correo esté sin verificar: los documentos
 * legales (el correo de verificación enlaza a ellos), la cita de invitado, que
 * es de quien no tiene cuenta, y las páginas de servicio.
 */
const EMAIL_PENDING_EXEMPT = [EMAIL_PENDING_PATH, '/legal', '/cita/', '/admin', '/error'];

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
  private readonly router = inject(Router);

  /**
   * El servidor dice que el correo de esta sesión está sin verificar. Pasa
   * sobre todo con Apple, que puede no dar el correo y se escribe a mano.
   * Solo cuenta un `false` explícito: un `/me` sin el campo no echa a nadie.
   */
  private emailUnverified = false;

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
    // Como el router de la app: con el correo sin verificar, cualquier pantalla
    // lleva a la de espera. Se mira en cada navegación y no solo al entrar,
    // porque un enlace o el botón atrás pueden sacarle de ella. El servicio
    // vive lo que la web, así que esta suscripción no hay que cortarla.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.enforceEmailVerified(e.urlAfterRedirects));
    void this.restore();
  }

  /** Si la sesión tiene el correo sin verificar. */
  get needsEmailVerification(): boolean {
    return this.isAuthenticated && this.emailUnverified;
  }

  private enforceEmailVerified(url: string): void {
    const path = url.split(/[?#]/)[0];
    if (this.needsEmailVerification) {
      if (!EMAIL_PENDING_EXEMPT.some(p => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`))) {
        void this.router.navigateByUrl(EMAIL_PENDING_PATH, { replaceUrl: true });
      }
    } else if (path === EMAIL_PENDING_PATH && this.statusSubject.value !== 'unknown') {
      // Ya verificado, o sin sesión: la pantalla de espera no tiene nada que
      // hacer y se vuelve a Explorar, como la app.
      void this.router.navigateByUrl('/', { replaceUrl: true });
    }
  }

  /** Vuelve a aplicar la regla sobre la página actual tras un cambio de sesión. */
  private recheckEmailVerified(): void {
    this.enforceEmailVerified(this.router.url);
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
      this.recheckEmailVerified();
    } catch (raw) {
      // Un token que ya no vale es un token que sobra. Sin esto la web se
      // quedaba con la sesión "a medias": cabecera de usuario y 401 en todo.
      //
      // Pero solo si el servidor lo ha rechazado. Sin red o con el backend
      // dormido no se sabe nada del token, y borrarlo cerraba la sesión a
      // quien abría la web en un mal momento: se deja guardado para que la
      // próxima carga lo vuelva a intentar.
      const error = ApiError.from(raw);
      if (error.isUnauthorized || error.isForbidden) {
        this.clearSession();
      } else {
        this.userSubject.next(null);
        this.statusSubject.next('anonymous');
      }
      this.recheckEmailVerified();
    }
  }

  async login(req: LoginRequest): Promise<void> {
    await this.auth.login(req);
    await this.refreshProfile();
    this.statusSubject.next('authenticated');
    this.closeAuthModal();
    this.recheckEmailVerified();
  }

  /** Tras el alta, la sesión ya viene abierta en la respuesta. */
  async onRegistered(): Promise<void> {
    await this.refreshProfile();
    this.statusSubject.next('authenticated');
    this.closeAuthModal();
    this.recheckEmailVerified();
  }

  /**
   * «Ya lo verifiqué»: relee `/me` y, si ya está, la regla de arriba saca de
   * la pantalla de espera. Devuelve si sigue pendiente.
   */
  async recheckEmail(): Promise<boolean> {
    await this.refreshProfile();
    this.recheckEmailVerified();
    return this.needsEmailVerification;
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
    this.emailUnverified = me.emailVerified === false;
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
    this.emailUnverified = false;
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
