import { Injectable, computed, inject, signal } from '@angular/core';
import { DialogService } from './dialog.service';

/** Un punto del usuario. */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Una posición y de dónde ha salido. Port de `UserFix`.
 *
 * `precise` distingue la lectura de ahora mismo de la última guardada de otra
 * visita: para ordenar una lista da igual; para escribir algo en el perfil no.
 */
export interface UserFix extends Coords {
  precise: boolean;
}

/**
 * En qué está el acceso a la ubicación. Port de `LocationAccess`, con lo
 * propio del navegador:
 *
 *  - `granted`: concedido, ya se puede leer la posición.
 *  - `prompt`: sin decidir; pedirla saca el diálogo del navegador.
 *  - `denied`: denegado, y **el navegador no vuelve a preguntar**: solo se
 *    reactiva desde el candado de la barra de direcciones. Es el
 *    `needsSettings` de la app.
 *  - `unavailable`: concedido pero no hay forma de saber dónde está (la
 *    ubicación del dispositivo apagada, sin señal, tiempo agotado). Es el
 *    `serviceDisabled` de la app: no es cosa de la web.
 *  - `unsupported`: el navegador no tiene ubicación o la página no va por
 *    HTTPS (solo funciona en HTTPS o en localhost).
 */
export type LocationAccess = 'granted' | 'prompt' | 'denied' | 'unavailable' | 'unsupported';

/** Dónde se recuerda la última posición entre visitas. */
const STORAGE_KEY = 'bipsy.location.last';

/**
 * Pasado esto la posición guardada ya no se usa ni para arrancar: es
 * «lo último que cacheó el sistema» de la app, y una de hace un mes puede ser
 * de otra ciudad.
 */
const STORED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Lo mismo que la app: precisión media y 15 s como mucho. */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 5 * 60_000,
};

/** De dónde sale la ubicación aproximada: la función de Vercel (`api/geo.js`). */
const GEO_ENDPOINT = '/api/geo';

/** Lo que se espera a la de la IP. Es un extra: si tarda, se sigue sin ella. */
const GEO_TIMEOUT_MS = 3_000;

/**
 * Ubicación aproximada por la IP: la ciudad, no la calle. Sirve para ordenar
 * mientras no hay permiso; en pantalla se dice «Cerca de Madrid», nunca «tu
 * ubicación».
 */
export interface ApproxFix extends Coords {
  city: string | null;
  country: string | null;
}

/**
 * La ubicación del usuario. Port de `location_provider.dart`, con un cambio
 * que pidió José (07/11/2026, «Booksy sabe dónde estoy y no me lo ha pedido»):
 *
 * **Al entrar no se pregunta nada.** La raíz llama `start()` al llegar a
 * Explorar, Buscar o una ficha, y entonces:
 *  - con el permiso ya concedido de antes, la posición precisa, en silencio
 *    (como la app: la guardada al instante y la de ahora cuando llega);
 *  - si no, una **aproximada por la IP** (`/api/geo`, cabeceras de Vercel),
 *    sin ningún diálogo. Ordena igual Destacados, Buscar sin zona y el mapa.
 *
 * El diálogo del navegador solo sale cuando el usuario lo provoca: el aviso
 * «Activa la ubicación…» de Explorar, «Usar mi ubicación» del buscador, abrir
 * el mapa o la fila de Ajustes. **La precisa siempre gana** a la de la IP.
 *
 * Null es un resultado normal, no un error: sin permiso, sin señal, sin la
 * función de Vercel (`ng serve`, otro hosting). Las listas siguen saliendo,
 * solo que sin ordenar por distancia.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly dialog = inject(DialogService);

  /** Null mientras no se sabe: nadie debe afirmar nada todavía. */
  readonly access = signal<LocationAccess | null>(null);
  /** La del navegador: la guardada de otra visita o la de ahora. */
  readonly fix = signal<UserFix | null>(null);
  /** La aproximada por la IP, de respaldo mientras no hay `fix`. */
  readonly approx = signal<ApproxFix | null>(null);
  /** Hay una petición en marcha (el diálogo del navegador abierto o esperando señal). */
  readonly asking = signal(false);

  /** La posición a secas, para lo único que necesita casi todo: ordenar. La precisa gana. */
  readonly coords = computed<Coords | null>(() => {
    const best = this.fix() ?? this.approx();
    return best ? { lat: best.lat, lng: best.lng } : null;
  });

  /** Lo que hay es la del navegador, no la de la IP: se puede hablar de kilómetros. */
  readonly precise = computed(() => !!this.fix());

  /**
   * La ciudad de la aproximada, solo mientras es la que manda. Para decir
   * «Cerca de Madrid»; nunca se presenta como la ubicación exacta.
   */
  readonly approxCity = computed(() => (this.fix() ? null : this.approx()?.city ?? null));

  private status: PermissionStatus | null = null;
  private started = false;

  /** Se resuelve cuando ya se sabe el estado del permiso. */
  private readonly known: Promise<void>;

  constructor() {
    if (!this.supported) {
      this.access.set('unsupported');
      this.known = Promise.resolve();
      return;
    }
    this.known = this.watchPermission();
  }

  /** Geolocalización disponible y en contexto seguro (HTTPS o localhost). */
  get supported(): boolean {
    return typeof window !== 'undefined'
      && window.isSecureContext !== false
      && typeof navigator !== 'undefined'
      && 'geolocation' in navigator;
  }

  /**
   * Lo que pasa al entrar, **sin ningún diálogo**. Con el permiso ya
   * concedido, la precisa; si no (sin decidir, denegado, sin geolocalización),
   * la aproximada por la IP.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    void this.known.then(() => {
      const access = this.access();
      if (access === 'granted' || access === 'unavailable') {
        void this.locate().then(result => {
          if (result !== 'granted') void this.loadApprox();
        });
      } else {
        void this.loadApprox();
      }
    });
  }

  /**
   * Lo pulsa quien quiere activarla (el aviso de Explorar, «Usar mi
   * ubicación», el mapa, la fila de Ajustes). Port de `requestLocationAccess`:
   * devuelve en qué acabó.
   *
   * Denegada, el navegador ya no enseña el diálogo y el `getCurrentPosition`
   * falla al momento; quien llama explica entonces cómo reactivarla.
   */
  async request(): Promise<LocationAccess> {
    if (!this.supported) return 'unsupported';
    return this.locate();
  }

  /**
   * Pide la precisa SOLO si todavía se puede preguntar y no hay ya una. Para
   * gestos que la quieren sin ser un «actívala» explícito, como abrir el mapa:
   * denegada no se insiste ni se explica nada.
   */
  requestIfUndecided(): void {
    if (this.access() === 'prompt' && !this.fix() && !this.asking()) void this.request();
  }

  /**
   * La aproximada por la IP. Cualquier fallo —sin la función (`ng serve`,
   * otro hosting), sin cabeceras, red— se traga: la web sigue como si no
   * hubiera ubicación.
   */
  private async loadApprox(): Promise<void> {
    if (this.approx() || typeof fetch !== 'function') return;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), GEO_TIMEOUT_MS);
    try {
      const res = await fetch(GEO_ENDPOINT, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller?.signal,
      });
      // Sin la función, el `rewrite` de la SPA (o `ng serve`) responde el
      // index.html con un 200: por eso se mira que de verdad sea JSON.
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return;
      this.approx.set(parseGeoResponse(await res.json()));
    } catch {
      // Ver arriba.
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Pedirla desde un botón, explicando qué hacer si no sale. Port de
   * `_pedirUbicacion` (Explorar) y `_activar` (Tu ubicación).
   *
   * Primero se intenta el diálogo del navegador. Si ya no pregunta —porque se
   * denegó antes— o no hay forma de saber dónde está, se dice cómo
   * arreglarlo: en la web no hay botón que abra los ajustes.
   */
  async activate(): Promise<LocationAccess> {
    const result = await this.request();
    // Concedida, o cerró el diálogo sin elegir: no hay nada que explicar.
    if (result === 'granted' || result === 'prompt') return result;
    await this.dialog.info({
      title: result === 'unavailable' ? 'No encontramos tu ubicación' : 'Ubicación desactivada',
      message: result === 'denied' ? deniedHelp()
        : result === 'unavailable' ? UNAVAILABLE_HELP
        : UNSUPPORTED_HELP,
    });
    return result;
  }

  /**
   * Lee la posición. El resultado no se da por hecho: el estado sale del
   * propio navegador (un fallo de señal no es un «no»).
   */
  private locate(): Promise<LocationAccess> {
    this.asking.set(true);
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const fix: UserFix = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            precise: true,
          };
          this.fix.set(fix);
          this.remember(fix);
          this.access.set('granted');
          this.asking.set(false);
          resolve('granted');
        },
        error => {
          let result: LocationAccess;
          if (error.code === error.PERMISSION_DENIED && this.status?.state === 'prompt') {
            // Chrome da «denegado» también al CERRAR el diálogo sin elegir, y
            // el permiso sigue sin decidir: se puede volver a preguntar.
            result = 'prompt';
          } else if (error.code === error.PERMISSION_DENIED) {
            result = 'denied';
            // Denegada: la guardada deja de valer, ni para ordenar. Queda la
            // de la IP, que no necesita permiso.
            this.fix.set(null);
            this.forget();
            if (this.started) void this.loadApprox();
          } else {
            // Sin señal o tiempo agotado: se queda la guardada, si había.
            result = 'unavailable';
          }
          this.access.set(result);
          this.asking.set(false);
          resolve(result);
        },
        POSITION_OPTIONS,
      );
    });
  }

  /**
   * El estado del permiso sin pedir nada, y atento a sus cambios: si se
   * concede o se quita desde el candado de la barra, todo se entera (en la app
   * es volver de los Ajustes del sistema).
   *
   * Safari antiguo y algunos Firefox no tienen `permissions.query` para la
   * ubicación: entonces no se sabe, y se deduce de si hay una posición
   * guardada (solo se guarda tras concederla).
   */
  private async watchPermission(): Promise<void> {
    const stored = this.recall();
    try {
      if (!navigator.permissions?.query) throw new Error('sin Permissions API');
      this.status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      this.onPermission(stored);
      this.status.addEventListener('change', () => this.onPermission(null));
    } catch {
      if (stored) {
        this.fix.set(stored);
        this.access.set('granted');
      } else {
        this.access.set('prompt');
      }
    }
  }

  private onPermission(stored: UserFix | null): void {
    const state = this.status?.state;
    if (state === 'granted') {
      // La guardada al instante; `start()` o `locate()` la corrigen.
      if (stored && !this.fix()) this.fix.set(stored);
      const before = this.access();
      this.access.set('granted');
      // Concedida desde el candado con la página abierta: a por la posición.
      if (before && before !== 'granted' && !this.asking()) void this.locate();
    } else if (state === 'denied') {
      this.fix.set(null);
      this.forget();
      this.access.set('denied');
      // Quitada desde el candado con la página abierta: queda la de la IP.
      if (this.started) void this.loadApprox();
    } else {
      this.access.set('prompt');
    }
  }

  // ----- RECORDAR ENTRE VISITAS --------------------
  //
  // En try/catch: en una ventana privada, con los datos bloqueados o en una
  // vista previa, el almacenamiento puede fallar o no existir, y la web tiene
  // que funcionar igual (solo que sin la posición de la visita anterior).

  private remember(fix: Coords): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: fix.lat, lng: fix.lng, at: Date.now() }));
    } catch {
      // Sin almacenamiento: la próxima visita empieza sin posición.
    }
  }

  private recall(): UserFix | null {
    try {
      return parseStoredFix(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  private forget(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nada que borrar.
    }
  }
}

/**
 * Distancia en kilómetros entre dos puntos (semiverseno). Port de `distanceKm`:
 * basta para decidir si la posición se ha movido, sin pedirle nada a Google.
 */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Lee la respuesta de `/api/geo`. Null si no trae un punto válido: las
 * cabeceras de Vercel faltan en local, con algunas VPN y con IPs que no sabe
 * situar. Exportada para los tests.
 */
export function parseGeoResponse(data: unknown): ApproxFix | null {
  if (!data || typeof data !== 'object') return null;
  const { lat, lng, city, country } = data as Record<string, unknown>;
  const toNumber = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN);
  const la = toNumber(lat);
  const lo = toNumber(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) return null;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  return { lat: la, lng: lo, city: text(city), country: text(country) };
}

/**
 * Lee lo guardado. Null si no hay, está roto o es demasiado viejo. Exportada
 * para los tests.
 */
export function parseStoredFix(raw: string | null, now = Date.now()): UserFix | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { lat?: unknown; lng?: unknown; at?: unknown };
    const { lat, lng, at } = data;
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof at !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    if (now - at > STORED_MAX_AGE_MS || at > now + 60_000) return null;
    return { lat, lng, precise: false };
  } catch {
    return null;
  }
}

/**
 * Cómo reactivarla, según el navegador: denegada, ninguno vuelve a preguntar
 * desde la página. Port de los textos de `exploreLocationDeniedMessage`.
 */
export function deniedHelp(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'El navegador ya no vuelve a preguntar. Para activarla: Ajustes › Privacidad y seguridad › '
      + 'Localización › Safari (o tu navegador) › «Al usar la app», y en la barra de direcciones '
      + 'pulsa «aA» › Ajustes del sitio web › Ubicación › Permitir. Después, recarga la página.';
  }
  if (/firefox/.test(ua)) {
    return 'El navegador ya no vuelve a preguntar. Para activarla: pulsa el icono a la izquierda de la '
      + 'dirección, quita el bloqueo de «Acceder a tu ubicación» y recarga la página.';
  }
  if (/safari/.test(ua) && !/chrome|chromium|edg/.test(ua)) {
    return 'El navegador ya no vuelve a preguntar. Para activarla: Safari › Ajustes › Sitios web › '
      + 'Ubicación, elige «Permitir» para Bipsy y recarga la página.';
  }
  return 'El navegador ya no vuelve a preguntar. Para activarla: pulsa el icono a la izquierda de la '
    + 'dirección › Permisos del sitio (o Configuración del sitio) › Ubicación › Permitir, y recarga la página.';
}

/** Sin geolocalización o sin HTTPS. */
export const UNSUPPORTED_HELP =
  'Este navegador no permite compartir la ubicación. Puedes elegir una zona en Buscar.';

/** Ubicación encendida pero sin posición: lo que se le dice. */
export const UNAVAILABLE_HELP =
  'No hemos podido saber dónde estás. Comprueba que la ubicación del dispositivo está encendida '
  + 'e inténtalo de nuevo.';
