import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

/**
 * Pantallas de segundo nivel que en el móvil no tienen cabecera propia, con
 * el título que lleva su barra. Las demás ya se la pintan (la ficha, la
 * reserva, el hilo de chat, los flujos con su «Volver») o son pestañas.
 */
const SCREENS: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/favoritos$/, title: 'Favoritos' },
  { pattern: /^\/resenas$/, title: 'Reseñas' },
  { pattern: /^\/pagos$/, title: 'Pagos' },
  { pattern: /^\/ajustes$/, title: 'Perfil' },
];

/**
 * Título de cada apartado de Ajustes (`?apartado=`), como la AppBar de su
 * pantalla en la app. Copia de los `label` de `SECTIONS` en profile.component:
 * importarlos de allí metería la página de Ajustes, que va en diferido, en el
 * paquete inicial. Si cambia uno, cambia el otro.
 */
const PROFILE_TITLES: Record<string, string> = {
  perfil: 'Editar perfil',
  direcciones: 'Mis direcciones',
  personas: 'Mis personas',
  seguridad: 'Contraseña y sesiones',
  avisos: 'Avisos',
  ayuda: 'Ayuda',
  'acerca-de': 'Acerca de Bipsy',
  legal: 'Legal',
  cuenta: 'Cuenta',
};

/**
 * La barra de arriba de las pantallas que no son pestaña, en el móvil. Port
 * del `AppBar` que llevan en la app: atrás a la izquierda y el título
 * centrado.
 *
 * Sin esto, Favoritos, Reseñas, Pagos o Perfil se quedaban sin barra de
 * pestañas —en la app tampoco la tienen— y sin ninguna forma de volver que no
 * fuera el botón del navegador.
 */
@Component({
  selector: 'app-mobile-topbar',
  standalone: true,
  template: `
    @if (title(); as t) {
      <header class="mtop">
        <button type="button" class="mtop__back" (click)="back()" aria-label="Volver">
          <span class="material-symbols-rounded">arrow_back_ios_new</span>
        </button>
        <h1 class="mtop__title">{{ t }}</h1>
        <span class="mtop__spacer" aria-hidden="true"></span>
      </header>
    }
  `,
  styles: [`
    :host { display: block; position: sticky; top: 0; z-index: 30; }
    .mtop {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      align-items: center;
      height: 52px;
      padding: 0 8px;
      background: var(--clr-nav-bg);
      backdrop-filter: blur(20px) saturate(1.5);
      -webkit-backdrop-filter: blur(20px) saturate(1.5);
      box-shadow: inset 0 -0.5px 0 var(--clr-border);
    }
    .mtop__back {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--clr-text);
      cursor: pointer;
    }
    .mtop__back:hover { background: var(--clr-surface); }
    .mtop__back .material-symbols-rounded { font-size: 20px; }
    .mtop__title {
      text-align: center;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.1px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
})
export class MobileTopbarComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly title = signal<string | null>(null);

  /** Si se llegó navegando dentro de la web: entonces «atrás» es el historial. */
  private navigated = false;

  constructor() {
    const update = (url: string) => {
      const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
      const section = path === '/ajustes'
        ? new URLSearchParams(url.split('?')[1]?.split('#')[0] ?? '').get('apartado')
        : null;
      this.title.set(
        (section && PROFILE_TITLES[section]) || SCREENS.find(s => s.pattern.test(path))?.title || null,
      );
      // Para que la página sepa que su título ya está arriba (styles.css).
      document.body.classList.toggle('has-mtop', !!this.title());
    };
    update(this.router.url || (typeof location === 'undefined' ? '/' : location.pathname));
    let first = true;
    this.router.events
      // Se corta al desmontarse: la barra va y viene cada vez que la ventana
      // cruza el corte de escritorio, y una suscripción viva de una barra ya
      // desmontada seguía poniendo `has-mtop` en el body en escritorio.
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(e => {
        update(e.urlAfterRedirects);
        if (!first) this.navigated = true;
        first = false;
      });
  }

  /** Al pasar a escritorio la barra se desmonta: el título vuelve a la página. */
  ngOnDestroy(): void {
    document.body.classList.remove('has-mtop');
  }

  /**
   * Atrás en el historial si se llegó desde la web; si se entró directo (un
   * enlace, una recarga), a Explorar: el `back()` del navegador sacaría de la
   * web.
   */
  back(): void {
    if (this.navigated) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/');
    }
  }
}
