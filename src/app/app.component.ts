import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { MaintenanceService } from './core/maintenance.service';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { PromoBarComponent } from './components/promo-bar/promo-bar.component';
import { SearchHeaderComponent } from './components/search-header/search-header.component';
import { AppBannerComponent } from './components/app-banner/app-banner.component';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { MaintenanceIndicatorComponent } from './components/maintenance-indicator/maintenance-indicator.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';
import { LEGAL_INDEX } from './pages/legal/legal.index';

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
    SearchHeaderComponent,
    FooterComponent,
    MaintenanceComponent,
    MaintenanceIndicatorComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Bipsy';

  readonly maintenance = inject(MaintenanceService);
  private readonly router = inject(Router);

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

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.path.set(pathOf(e.urlAfterRedirects)));
  }
}

/** `/admin/?x=1#y` → `/admin`. */
function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '');
  return path || '/';
}
