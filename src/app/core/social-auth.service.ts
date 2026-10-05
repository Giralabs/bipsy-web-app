import { Injectable, inject } from '@angular/core';
import { ApiError } from './api-error';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { AuthResponse } from '../models/bipsy.models';
import {
  firebaseConfig,
  isAppleSignInConfigured,
  isGoogleSignInConfigured,
} from '../../environments/firebase.config';

/** Con quién se entra. Lo que cambia es el proveedor y el endpoint, nada más. */
export type SocialProvider = 'google' | 'apple';

/**
 * Lo que devuelve el proveedor una vez pasado por Firebase.
 *
 * `name` viaja al backend porque **Apple lo entrega una sola vez**, la primera
 * que se autoriza, y nunca más: si no se guarda entonces ya no hay forma de
 * recuperarlo. Sin él, a quien oculta su correo se le acabaría llamando
 * "a1b2c3d4", que es lo que el servidor deduce de una dirección de relay.
 */
export interface SocialIdentity {
  provider: SocialProvider;
  idToken: string;
  email: string | null;
  name: string | null;
}

/**
 * Respuesta de `POST /auth/google` y `POST /auth/apple`.
 *
 * Con `needsProfile` la cuenta es nueva y falta el teléfono: se pide y se
 * reintenta con él. Si no, `auth` trae la sesión.
 */
export interface SocialSignInResponse {
  needsProfile: boolean;
  name?: string;
  email?: string;
  auth?: AuthResponse;
}

/** El usuario cerró la ventana del proveedor. No es un error que contar. */
export class SocialSignInCancelled extends Error {
  constructor() {
    super('Acceso cancelado');
    this.name = 'SocialSignInCancelled';
  }
}

/**
 * Falta configuración **nuestra** (proveedor sin activar en Firebase, dominio
 * sin autorizar, Services ID de Apple sin la Return URL).
 *
 * Se distingue del resto porque no se arregla reintentando: decir "algo ha
 * fallado" invita a volver a pulsar algo que no puede funcionar. Mismo criterio
 * que `GoogleNotConfigured` en `packages/gipsi_auth`.
 */
export class SocialSignInUnavailable extends Error {
  constructor(readonly provider: SocialProvider) {
    super(
      `El acceso con ${provider === 'apple' ? 'Apple' : 'Google'} no está disponible ahora mismo.`,
    );
    this.name = 'SocialSignInUnavailable';
  }
}

/** Códigos de Firebase que significan "ha cerrado la ventana". */
const CANCELLED = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
];

/** Códigos que son configuración que falta, no un fallo del usuario. */
const NOT_CONFIGURED = [
  'auth/operation-not-allowed',
  'auth/unauthorized-domain',
  'auth/invalid-oauth-client-id',
  'auth/invalid-oauth-provider',
  'auth/auth-domain-config-required',
];

/**
 * Acceso con Google y con Apple. Port de `google_auth.dart` y `apple_auth.dart`
 * (`packages/gipsi_auth`).
 *
 * ⚠️ **El backend verifica un ID token de FIREBASE**, no uno de Google ni el de
 * Apple a secas (`FirebaseTokenVerifier` comprueba firma, emisor y `aud` contra
 * el `project-id`, y `SocialIdentityService` lee de quién viene en el claim
 * `firebase.sign_in_provider`). Por eso la web pasa por Firebase Auth y no por
 * Google Identity Services ni por el JS de Apple: ninguno de los dos tokens
 * superaría esa validación.
 *
 * El SDK se carga **en diferido**, solo cuando alguien pulsa un botón: son unos
 * cuantos kilobytes que no tiene por qué descargarse quien entra con su correo.
 */
@Injectable({ providedIn: 'root' })
export class SocialAuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);

  /** Si la pantalla debe ofrecer ese botón. Sin configurar, se esconde. */
  isAvailable(provider: SocialProvider): boolean {
    return provider === 'apple' ? isAppleSignInConfigured() : isGoogleSignInConfigured();
  }

  get googleAvailable(): boolean {
    return this.isAvailable('google');
  }

  get appleAvailable(): boolean {
    return this.isAvailable('apple');
  }

  /** Abre la ventana del proveedor y devuelve el ID token de Firebase. */
  async obtainIdentity(provider: SocialProvider): Promise<SocialIdentity> {
    if (!this.isAvailable(provider)) {
      throw new SocialSignInUnavailable(provider);
    }

    const [{ initializeApp, getApps }, auth] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const { getAuth, GoogleAuthProvider, OAuthProvider, signInWithPopup } = auth;

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const firebaseAuth = getAuth(app);
    // La ventana del proveedor sale en el idioma del navegador y no en inglés.
    firebaseAuth.useDeviceLanguage();

    try {
      const credential = await signInWithPopup(
        firebaseAuth,
        provider === 'apple'
          ? appleProvider(new OAuthProvider('apple.com'))
          : googleProvider(new GoogleAuthProvider()),
      );
      return {
        provider,
        idToken: await credential.user.getIdToken(),
        // En minúsculas y sin espacios, que es como lo guarda el servidor.
        email: credential.user.email?.trim().toLowerCase() ?? null,
        name: credential.user.displayName?.trim() || null,
      };
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      // Cerrar la ventana no es un fallo: no se le enseña un error a quien ha
      // decidido no seguir.
      if (CANCELLED.includes(code)) {
        throw new SocialSignInCancelled();
      }
      if (NOT_CONFIGURED.includes(code)) {
        // El mensaje que ve el usuario no puede decir «activa el proveedor en
        // Firebase», pero sin el código delante no hay forma de saber cuál de
        // las tres cosas falta, y son tres consolas distintas.
        console.warn(
          `[Bipsy] ${provider === 'apple' ? 'Apple' : 'Google'} no está configurado para la web (${code}).\n` +
            '  auth/operation-not-allowed → Firebase Console → Authentication → Sign-in method: activa el proveedor.\n' +
            `  auth/unauthorized-domain   → Authentication → Settings → Authorized domains: añade ${location.hostname}.\n` +
            '  Con Apple hace falta además un Services ID con Return URL ' +
            `https://${firebaseConfig.authDomain}/__/auth/handler`,
        );
        throw new SocialSignInUnavailable(provider);
      }
      throw error;
    }
  }

  /**
   * Canjea la identidad por la sesión de Bipsy.
   *
   * `phone` solo hace falta la primera vez (cuenta nueva): el backend responde
   * `needsProfile` y la pantalla lo pide antes de reintentar.
   */
  async signIn(identity: SocialIdentity, phone?: string): Promise<SocialSignInResponse> {
    const res = await this.api.post<SocialSignInResponse>(
      identity.provider === 'apple' ? '/auth/apple' : '/auth/google',
      {
        idToken: identity.idToken,
        ...(phone ? { phone } : {}),
        ...(identity.name ? { name: identity.name } : {}),
      },
      false,
    );
    // Si la respuesta trae sesión, se persiste; si pide perfil, no hay nada
    // que guardar todavía.
    if (res.auth) {
      this.tokens.save(res.auth);
    }
    return res;
  }

  /**
   * Cierra la sesión de Firebase (no la de Bipsy) al hacer logout, para que la
   * próxima vez vuelva a preguntar la cuenta en vez de entrar con la última.
   *
   * Es best-effort y nunca lanza: que no hubiera sesión de Firebase no es un
   * fallo del que haya que enterarse.
   */
  async signOut(): Promise<void> {
    try {
      const [{ getApps }, { getAuth, signOut }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      // Sin app inicializada no hay nada que cerrar, y crearla aquí solo para
      // eso descargaría el SDK a quien entró con contraseña.
      if (getApps().length === 0) return;
      await signOut(getAuth(getApps()[0]));
    } catch {
      // best-effort
    }
  }
}

/**
 * El mensaje que ve el usuario cuando entrar con un proveedor falla.
 *
 * Lo que falta configurar se dice tal cual: no se arregla reintentando, y un
 * "no se pudo, inténtalo de nuevo" invita a volver a pulsar algo que no puede
 * funcionar. Mismo criterio que `onNotConfigured` en `login_screen.dart`.
 */
export function socialMessageFor(raw: unknown, provider: SocialProvider): string {
  if (raw instanceof SocialSignInUnavailable) return raw.message;
  const error = ApiError.from(raw);
  if (error.networkError) return 'Sin conexión con el servidor.';
  if (error.status > 0) return error.message;
  return `No se pudo continuar con ${provider === 'apple' ? 'Apple' : 'Google'}. Inténtalo de nuevo.`;
}

/**
 * Sin esto entra con la última cuenta sin preguntar, y quien tiene varias no
 * puede elegir. Equivale al `forceAccountPicker` de `google_auth.dart`.
 */
function googleProvider<T extends { setCustomParameters(p: Record<string, string>): unknown }>(
  provider: T,
): T {
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

/**
 * Los dos permisos que pide la app (`AppleIDAuthorizationScopes`). El nombre
 * solo llega la primera vez, así que hay que pedirlo desde el principio.
 */
function appleProvider<T extends { addScope(scope: string): unknown }>(provider: T): T {
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}
