import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { SessionService } from '../../core/session.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';
import { UserProfileDto } from '../../models/bipsy.models';
import { scrollToBusinessPromo } from '../../shared/business-promo';

/**
 * Hasta dónde llega, bajando, el buscador grande del héroe de la portada.
 * Pasado esto la barra enseña el suyo: así nunca hay dos a la vez ni
 * ninguno.
 */
const HERO_SEARCH_BOTTOM = 520;

/** Páginas de flujo, sin buscador en la barra. */
const NO_SEARCH = /^\/(acceder|crear-cuenta|recuperar|soporte|negocio\/[^/]+\/reservar|citas\/[^/]+\/cambiar)$/;

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SearchBarComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  currentUser: UserProfileDto | null = null;

  /** Mensajes sin leer. Una consulta agregada, no la suma de la bandeja. */
  unread = 0;

  /** Se ha bajado algo: la barra gana su filo. */
  scrolled = false;

  /** En la portada, hasta dejar atrás el buscador grande del héroe. */
  private onHome = false;
  private pastHero = false;
  /** Página con buscador propio o de flujo: la barra no enseña el suyo. */
  private onSearch = false;

  get showSearch(): boolean {
    return !this.onSearch && (!this.onHome || this.pastHero);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled = window.scrollY > 4;
    this.pastHero = window.scrollY > HERO_SEARCH_BOTTOM;
  }

  ngOnInit(): void {
    const track = (url: string) => {
      const path = url.split(/[?#]/)[0];
      this.onHome = path === '/';
      // Buscar ya tiene el suyo, y en los flujos (entrar, registrarse, pedir
      // cita) se viene a terminar algo: un buscador ahí solo invita a irse.
      this.onSearch = path === '/buscar' || NO_SEARCH.test(path);
    };
    track(this.router.url || (typeof location === 'undefined' ? '/' : location.pathname));
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(e => track(e.urlAfterRedirects));
    this.onScroll();

    // El socket y el «entra para seguir» viven en la raíz (AppComponent): esta
    // barra solo se monta en escritorio, y en el móvil se quedaban sin nadie.
    //
    // Las tres suscripciones se cortan al desmontarse: la barra se monta y se
    // desmonta cada vez que la ventana cruza el corte de escritorio, y sin
    // esto cada vuelta dejaba otra copia viva pidiendo el globo de no leídos.
    this.session.currentUser$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(user => {
      this.currentUser = user;
      if (user) {
        void this.refreshUnread();
      } else {
        this.unread = 0;
      }
    });

    // Un mensaje que llega mientras se está en otra pantalla tiene que
    // encender el globo sin esperar a que alguien abra la bandeja.
    this.socket.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event.type === 'message.created' || event.type === 'socket.connected') {
        void this.refreshUnread();
      }
    });
  }

  private async refreshUnread(): Promise<void> {
    try {
      this.unread = await this.chat.unreadCount();
    } catch {
      // Un globo que no se puede calcular es un globo que no se pinta, no una
      // barra rota.
      this.unread = 0;
    }
  }

  goToLogin(): void {
    const returnTo = this.router.url;
    this.router.navigate(['/acceder'], {
      queryParams: returnTo.startsWith('/acceder') ? {} : { returnTo },
    });
  }

  goToRegister(): void {
    this.router.navigate(['/crear-cuenta']);
  }

  onBizPromoClick(): void {
    scrollToBusinessPromo(this.router);
  }
}
