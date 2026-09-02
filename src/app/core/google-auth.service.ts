import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';
import { AuthResponse } from '../models/bipsy.models';
import { firebaseConfig, isGoogleSignInConfigured } from '../../environments/firebase.config';

/**
 * Respuesta de `POST /auth/google`.
 *
 * Con `needsProfile` la cuenta es nueva y falta el teléfono: se pide y se
 * reintenta con él. Si no, `auth` trae la sesión.
 */
export interface GoogleSignInResponse {
  needsProfile: boolean;
  name?: string;
  email?: string;
  auth?: AuthResponse;
}

/** El usuario cerró la ventana de Google. No es un error que contar. */
export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Acceso con Google cancelado');
    this.name = 'GoogleSignInCancelled';
  }
}

/**
 * Acceso con Google. Port de `google_auth.dart`.
 *
 * ⚠️ **El backend verifica un ID token de FIREBASE**, no uno de Google a secas
 * (`FirebaseTokenVerifier` comprueba firma, emisor y `aud` contra el
 * `project-id`). Por eso la web pasa por Firebase Auth y no por Google
 * Identity Services directamente: un token de GIS no superaría esa validación.
 *
 * El SDK se carga **en diferido**, solo cuando alguien pulsa el botón: son
 * unos cuantos kilobytes que no tiene por qué descargarse quien entra con su
 * correo.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);

  /** Si la pantalla debe ofrecer el botón. Sin claves, se esconde. */
  get isAvailable(): boolean {
    return isGoogleSignInConfigured();
  }

  /** Abre la ventana de Google y devuelve el ID token de Firebase. */
  async obtainIdToken(): Promise<string> {
    const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] =
      await Promise.all([import('firebase/app'), import('firebase/auth')]);

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    try {
      const credential = await signInWithPopup(auth, provider);
      return await credential.user.getIdToken();
    } catch (error) {
      const code = (error as { code?: string }).code ?? '';
      // Cerrar la ventana no es un fallo: no se le enseña un error a quien ha
      // decidido no seguir.
      if (code.includes('popup-closed') || code.includes('cancelled-popup')) {
        throw new GoogleSignInCancelled();
      }
      throw error;
    }
  }

  /**
   * Canjea el token por la sesión de Bipsy.
   *
   * `phone` solo hace falta la primera vez (cuenta nueva): el backend responde
   * `needsProfile` y la pantalla lo pide antes de reintentar.
   */
  async signIn(idToken: string, phone?: string): Promise<GoogleSignInResponse> {
    const res = await this.api.post<GoogleSignInResponse>(
      '/auth/google',
      { idToken, ...(phone ? { phone } : {}) },
      false,
    );
    // Si la respuesta trae sesión, se persiste; si pide perfil, no hay nada
    // que guardar todavía.
    if (res.auth) {
      this.tokens.save(res.auth);
    }
    return res;
  }
}
