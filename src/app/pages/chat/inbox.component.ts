import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { ChatSocketService } from '../../core/chat-socket.service';
import { BreakpointService } from '../../core/breakpoint.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ConversationResponse } from '../../models/bipsy.models';
import { ButtonComponent } from '../../components/button/button.component';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ChatConversationListComponent } from './conversation-list.component';

/**
 * Bandeja de mensajes. Port de `ChatInboxScreen`.
 *
 * Es una pestaña de la barra y la lista de negocios con los que se puede
 * hablar: al reservar, el servidor abre el hilo solo, así que el negocio
 * aparece aquí sin tener que entrar en la cita para escribir por primera vez.
 */
@Component({
  selector: 'app-chat-inbox',
  standalone: true,
  imports: [ButtonComponent, AvatarComponent, ChatConversationListComponent, RouterLink],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.css',
})
export class ChatInboxComponent implements OnInit, AfterViewInit {
  private readonly chat = inject(ChatRepository);
  private readonly session = inject(SessionService);
  private readonly socket = inject(ChatSocketService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly desktop = inject(BreakpointService).desktop;

  conversations: ConversationResponse[] = [];
  /** Null mientras la sesión no se ha resuelto: ni pantalla de entrar ni lista. */
  isAuthenticated: boolean | null = null;
  isLoading = true;
  loadError: ApiError | null = null;

  ngOnInit(): void {
    // Igual que Mis citas: sin sesión no se pide la bandeja siquiera. Se
    // pedía, el servidor respondía 401 y la pestaña enseñaba el error rojo,
    // que suena a que algo se ha roto cuando solo es que no has entrado.
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (this.isAuthenticated) {
        void this.load();
      } else {
        this.conversations = [];
        this.isLoading = false;
      }
    });

    // Un mensaje nuevo mientras se mira la bandeja la refresca sola, sin
    // esqueleto: la lista no parpadea por cada mensaje que entra.
    this.socket.events$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (this.isAuthenticated && (event.type === 'message.created' || event.type === 'socket.connected')) {
        void this.load(true);
      }
    });
  }

  async load(quiet = false): Promise<void> {
    if (!quiet) {
      this.isLoading = true;
      this.loadError = null;
    }
    try {
      this.conversations = await this.chat.inbox();
      this.loadError = null;
    } catch (raw) {
      // Un refresco silencioso que falla no tapa la lista que ya se ve.
      if (!quiet || this.conversations.length === 0) {
        this.loadError = ApiError.from(raw);
      }
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin(): void {
    void this.router.navigate(['/acceder'], { queryParams: { returnTo: '/mensajes' } });
  }

  goExplore(): void {
    void this.router.navigate(['/']);
  }

  get avatarPhoto(): string | null {
    return this.session.currentUser?.profileImageUrl ?? null;
  }

  get avatarName(): string | null {
    return this.session.currentUser?.name ?? null;
  }

  get avatarLink(): string {
    return this.session.currentUser ? '/ajustes' : '/acceder';
  }

  /**
   * En escritorio las dos columnas ocupan lo que queda bajo la cabecera, igual
   * que el hilo (`--th-top` allí): se mide dónde empieza la página porque la
   * tira promocional puede estar o no según se haya cerrado.
   */
  ngAfterViewInit(): void {
    const measure = () => {
      const el = this.host.nativeElement;
      const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
      el.style.setProperty('--in-top', `${Math.round(top)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', measure));
  }
}
