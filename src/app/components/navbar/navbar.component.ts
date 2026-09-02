import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../../core/session.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';
import { UserProfileDto } from '../../models/bipsy.models';
import { ButtonComponent } from '../button/button.component';
import { scrollToBusinessPromo } from '../../shared/business-promo';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ButtonComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);
  private readonly router = inject(Router);

  currentUser: UserProfileDto | null = null;

  /** Mensajes sin leer. Una consulta agregada, no la suma de la bandeja. */
  unread = 0;

  ngOnInit(): void {
    this.session.currentUser$.subscribe(user => {
      this.currentUser = user;
      // Sin sesión no hay globo que pintar, ni petición que hacer, ni socket
      // que mantener abierto.
      if (user) {
        void this.refreshUnread();
        this.socket.connect();
      } else {
        this.unread = 0;
        this.socket.disconnect();
      }
    });

    // Un mensaje que llega mientras se está en otra pantalla tiene que
    // encender el globo sin esperar a que alguien abra la bandeja.
    this.socket.events$.subscribe(event => {
      if (event.type === 'message.created' || event.type === 'socket.connected') {
        void this.refreshUnread();
      }
    });

    // Cualquier acción que exija sesión abre el acceso. Ya no hay modal: es
    // una pantalla, como en la app, y así el navegador puede recordar la
    // contraseña y el enlace se puede compartir.
    this.session.isAuthModalOpen$.subscribe(open => {
      if (open) {
        this.session.closeAuthModal();
        this.goToLogin();
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
