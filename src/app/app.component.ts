import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, Scroll } from '@angular/router';
import { filter } from 'rxjs';
import { MaintenanceService } from './core/maintenance.service';
import { BreakpointService } from './core/breakpoint.service';
import { SessionService } from './core/session.service';
import { ChatSocketService } from './core/chat-socket.service';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { PromoBarComponent } from './components/promo-bar/promo-bar.component';
import { AppBannerComponent } from './components/app-banner/app-banner.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { MaintenanceIndicatorComponent } from './components/maintenance-indicator/maintenance-indicator.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { MobileTopbarComponent } from './components/mobile-topbar/mobile-topbar.component';
import { ToastHostComponent } from './components/toast-host/toast-host.component';
import { PaymentRequestGateComponent } from './components/payment-request-gate/payment-request-gate.component';
import { LEGAL_INDEX } from './pages/legal/legal.index';
import { STORE_LINKS_READY } from './data/app-links';

/** Páginas con pie: las públicas de descubrir. `negocio/:id` sí; su `/reservar`, no. */
const FOOTER_PAGES = /^(\/|\/buscar|\/negocio\/[^/]+|\/legal(\/[^/]+)?|\/descargar(\/negocio)?)$/;

/** La puerta del equipo: sigue sirviéndose en mantenimiento. */
const ADMIN_PATH = '/admin';

/**
 * Lo otro que se sirve en mantenimiento: los documentos que exige la ley, y
 * solo esos. Las apps enlazan a los términos y a la privacidad, y Apple revisa
 * que esos enlaces lleven al texto y no a un cartel de «volvemos pronto».
 *
 * Direcciones exactas sacadas de la lista de documentos, nunca un prefijo:
 * con `startsWith('/legal')` entraría cualquier cosa que alguien escriba
 * detrás. Contacto, Quiénes somos y Seguridad (`HELP_INDEX`) siguen cerradas.
 * La página no pide nada a la API, así que abrirla no deja pasar ninguna
 * petición.
 */
const OPEN_DURING_MAINTENANCE: ReadonlySet<string> = new Set([
  ADMIN_PATH,
  ...LEGAL_INDEX.map(entry => `/legal/${entry.slug}`),
  '/descargar',
  '/descargar/negocio',
]);

/**
 * Las invitaciones también se sirven en mantenimiento: llegan desde un mensaje
 * de WhatsApp de alguien que espera que funcione, y la página no pide nada a
 * la API. Llevan el código en la dirección, así que no caben en la lista de
 * arriba; el patrón admite un solo segmento detrás y nada más, por lo mismo
 * que allí se evitan los prefijos.
 */
const INVITE_PATH = /^\/(equipo|invitacion)\/[A-Za-z0-9_-]{1,64}$/;

function isOpenDuringMaintenance(path: string): boolean {
  return OPEN_DURING_MAINTENANCE.has(path) || INVITE_PATH.test(path);
}

/**
 * La raíz. Además del armazón de siempre, decide entre tres cosas según
 * `MaintenanceService`:
 *
 *  - **La web**, con su barra, su pie y sus pestañas. Lo normal, y también lo
 *    que ve el equipo cuando entra con pase durante un mantenimiento.
 *  - **La pantalla de mantenimiento**, sola, en cualquier dirección. No se
 *    monta ni el `router-outlet`: la página pedida no llega a crearse, así que
 *    tampoco hace ninguna petición.
 *  - **`/admin` o un documento legal en mantenimiento**: la ruta, sin nada
 *    alrededor. La barra y el pie son enlaces a una web que está cerrada.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AppBannerComponent,
    TabBarComponent,
    PromoBarComponent,
    NavbarComponent,
    FooterComponent,
    MaintenanceComponent,
    MaintenanceIndicatorComponent,
    ConfirmDialogComponent,
    MobileTopbarComponent,
    ToastHostComponent,
    PaymentRequestGateComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Bipsy';

  readonly maintenance = inject(MaintenanceService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly socket = inject(ChatSocketService);

  /** Escritorio o app: solo se monta el armazón del tamaño en el que se está. */
  readonly desktop = inject(BreakpointService).desktop;

  /** La tira de descarga solo tiene sentido con las fichas de las tiendas publicadas. */
  readonly storeLinksReady = STORE_LINKS_READY;

  /**
   * La ruta en la que se está, sin parámetros.
   *
   * Arranca de la barra de direcciones y no de `router.url`, que vale `/`
   * hasta que termina la primera navegación: recargando en `/admin` durante
   * un mantenimiento se veía un instante la pantalla de mantenimiento antes
   * del formulario.
   */
  private readonly path = signal(pathOf(typeof location === 'undefined' ? '/' : location.pathname));

  /** Web cerrada para esta persona, que además no está en una de las direcciones abiertas. */
  readonly showMaintenance = computed(
    () => this.maintenance.blocked() && !isOpenDuringMaintenance(this.path()),
  );

  /** Si se pinta lo de alrededor: barra, buscador, pie y pestañas. */
  readonly chrome = computed(() => !this.maintenance.blocked());

  /**
   * El pie del sitio, solo en las páginas de descubrir: Explorar, Buscar, la
   * ficha de un negocio y las legales. En las de USAR la cuenta —citas, chat,
   * ajustes, reservar, entrar— la app no tiene pie, y aquí sumaba 400 px de
   * scroll debajo de un formulario de dos campos.
   */
  readonly showFooter = computed(() => FOOTER_PAGES.test(this.path()));

  @ViewChild('main') private main?: ElementRef<HTMLElement>;

  constructor() {
    let first = true;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = pathOf(e.urlAfterRedirects);
        const changedPage = path !== this.path();
        this.path.set(path);
        // Al cambiar de página, el foco va al contenido nuevo: si no, quien
        // navega con teclado o lector se queda en el enlace que pulsó, en una
        // página que ya no existe, y no se entera de que ha cambiado. Solo
        // entre páginas: un filtro que toca la query no mueve nada.
        if (!first && changedPage) {
          setTimeout(() => this.main?.nativeElement.focus({ preventScroll: true }));
        }
        first = false;
      });

    // ── Dónde queda la página al navegar ──
    // Una página nueva empieza arriba: al tocar un negocio desde media portada,
    // la ficha se abría a esa misma altura, a mitad de sus servicios. Atrás y
    // adelante vuelven a donde se estaba, como en la app. Si solo cambia la
    // query —los filtros de Buscar la reescriben a cada toque—, la página no se
    // mueve: con `scrollPositionRestoration: 'enabled'` saltaba arriba con cada
    // filtro, por eso se hace aquí y no en `app.config`.
    const viewport = inject(ViewportScroller);
    let scrolledPath = this.path();
    this.router.events
      .pipe(filter((e): e is Scroll => e instanceof Scroll))
      .subscribe(e => {
        const url = 'urlAfterRedirects' in e.routerEvent ? e.routerEvent.urlAfterRedirects : e.routerEvent.url;
        const path = pathOf(url);
        const changedPage = path !== scrolledPath;
        scrolledPath = path;
        if (e.position) {
          // La página vuelve a pintarse en diferido: se espera a que exista
          // para no quedarse topada en lo alto de un `<main>` aún vacío.
          const position = e.position;
          setTimeout(() => viewport.scrollToPosition(position), 50);
        } else if (changedPage && !e.anchor) {
          viewport.scrollToPosition([0, 0]);
        }
      });

    hideIconLigaturesFromScreenReaders();

    // ── Lo que no depende del tamaño de pantalla ──
    // Vivía en la barra de escritorio, y desde que esa barra solo se monta en
    // escritorio el móvil se quedaba sin chat en tiempo real y sin ir al acceso.

    // Con sesión, el socket del chat abierto; sin ella, cerrado.
    this.session.currentUser$.subscribe(user => {
      if (user) {
        this.socket.connect();
      } else {
        this.socket.disconnect();
      }
    });

    // Cualquier acción que exija sesión lleva al acceso, y de vuelta a donde
    // se estaba al terminar.
    this.session.isAuthModalOpen$.subscribe(open => {
      if (!open) return;
      this.session.closeAuthModal();
      const returnTo = this.router.url;
      void this.router.navigate(['/acceder'], {
        queryParams: returnTo.startsWith('/acceder') ? {} : { returnTo },
      });
    });
  }

  skipToContent(event: Event): void {
    event.preventDefault();
    this.main?.nativeElement.focus();
  }
}

/**
 * Los iconos de Material Symbols son texto: la ligadura `search` se pinta como
 * una lupa, pero el lector de pantalla lee «search», en inglés y en mitad de
 * cada botón. Se marcan todos como decorativos según aparecen.
 *
 * Es seguro porque ningún botón depende de su icono para tener nombre: los
 * que solo llevan icono tienen `aria-label` (lo comprueba quien añada uno).
 * Un observador en vez de `aria-hidden` en cada plantilla: son cientos, y el
 * que se olvide vuelve a leerse en inglés.
 */
function hideIconLigaturesFromScreenReaders(): void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const SELECTOR = '.material-symbols-rounded:not([aria-hidden])';
  const mark = (root: ParentNode) => {
    root.querySelectorAll(SELECTOR).forEach(el => el.setAttribute('aria-hidden', 'true'));
  };
  new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node instanceof Element) {
          if (node.matches(SELECTOR)) node.setAttribute('aria-hidden', 'true');
          mark(node);
        }
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
  mark(document);
}

/** `/admin/?x=1#y` → `/admin`. */
function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path || '/';
}
