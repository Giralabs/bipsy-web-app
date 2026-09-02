import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';

interface Tab {
  route: string;
  icon: string;
  label: string;
  /** Solo la pestaña de chat lleva contador. */
  badge?: boolean;
}

/**
 * Barra inferior flotante. Port de `GipsiAdaptiveTabBar` + `MainShell`.
 *
 * **Tres pestañas, no cuatro.** Son las mismas que la app: Explorar, Mis citas
 * y Chat. Perfil salió de la barra a propósito —se entra por la foto de la
 * esquina, que está en las tres pantallas y en el mismo sitio—; una pestaña
 * para los ajustes ocupaba un cuarto de la barra para algo que se abre una vez
 * al mes. Buscar tampoco es pestaña: se llega desde el buscador de Explorar.
 *
 * Geometría copiada de la app: barra de 68 px con radio xxl, margen lateral de
 * 16 y 12 por debajo, y el «blob» de 52 px detrás de la pestaña activa.
 */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.css',
})
export class TabBarComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);

  readonly tabs: Tab[] = [
    { route: '/home', icon: 'explore', label: 'Explorar' },
    // Un reloj y no un calendario: una cita es una hora, no un mes. Mismo
    // criterio que la app.
    { route: '/appointments', icon: 'schedule', label: 'Mis citas' },
    { route: '/mensajes', icon: 'chat_bubble', label: 'Chat', badge: true },
  ];

  unread = 0;

  private subs = new Subscription();

  ngOnInit(): void {
    this.subs.add(
      this.session.status$.subscribe(status => {
        if (status !== 'authenticated') {
          this.unread = 0;
          return;
        }
        void this.loadUnread();
      }),
    );
    // Un mensaje que llega estando en otra pantalla tiene que encender el
    // globo sin esperar a que alguien abra la bandeja.
    this.subs.add(this.socket.events$.subscribe(() => void this.loadUnread()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private async loadUnread(): Promise<void> {
    try {
      this.unread = await this.chat.unreadCount();
    } catch {
      // Un globo que no se puede calcular es un globo que no se pinta. Un 401
      // del contador no puede tirar la barra de toda la app.
      this.unread = 0;
    }
  }
}
