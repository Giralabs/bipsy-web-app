import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { ChatRepository } from '../../repositories/chat.repository';
import { ChatSocketService } from '../../core/chat-socket.service';

interface Tab {
  route: string;
  /** Otras rutas que viven dentro de esta pestaña y también llevan barra. */
  also?: string[];
  icon: string;
  label: string;
  /** Solo la pestaña de chat lleva contador. */
  badge?: boolean;
}

/** El «blob» crece hasta esto al tocar. Valor de GipsiAdaptiveTabBar. */
const PRESS_SCALE = 1.22;

/**
 * Barra inferior flotante. Port de `GipsiAdaptiveTabBar` + `MainShell`.
 *
 * **Tres pestañas, no cuatro.** Las mismas que la app: Explorar, Mis citas y
 * Chat. Perfil salió de la barra a propósito —se entra por la foto de la
 * esquina, que está en las tres pantallas y en el mismo sitio—; y Buscar
 * tampoco es pestaña: se llega desde el buscador de Explorar.
 *
 * **Solo en las tres pantallas del shell.** En la app, el hilo de chat, el
 * perfil, la ficha y la reserva van fuera del `ShellRoute` y no pintan barra:
 * el hilo, textualmente, «para que el teclado y el compositor tengan todo el
 * alto». Aquí igual, y por el mismo motivo.
 *
 * **El gesto de la gota** es lo que la hace suya: al mantener pulsado el blob
 * crece con un rebote y sigue al dedo de forma continua —no salta de pestaña
 * en pestaña—, y al soltar cae en la más cercana. Se estira algo más de lo que
 * crece, que es lo que le da el aire elástico.
 */
@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.css',
})
export class TabBarComponent implements OnInit, OnDestroy {
  private readonly session = inject(SessionService);
  private readonly chat = inject(ChatRepository);
  private readonly socket = inject(ChatSocketService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  /**
   * La píldora, por setter y no por propiedad.
   *
   * Está dentro de un `@if` que arranca en falso —al construirse el componente
   * la ruta todavía no ha resuelto y no se sabe si toca barra—, así que en
   * `ngAfterViewInit` no existía y la consulta se quedaba vacía para siempre:
   * ancho 0, y con él un blob de dos píxeles pegado al borde. El setter salta
   * cada vez que la consulta cambia, que es justo cuando aparece.
   */
  pill?: ElementRef<HTMLElement>;

  @ViewChild('pill')
  set pillRef(ref: ElementRef<HTMLElement> | undefined) {
    this.pill = ref;
    this.observer?.disconnect();
    if (!ref) {
      return;
    }
    if (typeof ResizeObserver === 'undefined') {
      this.measure();
      return;
    }
    this.observer = new ResizeObserver(() => {
      this.measure();
      // El observador corre fuera de Angular: hay que pedir el repintado.
      this.cdr.detectChanges();
    });
    this.observer.observe(ref.nativeElement);
  }

  readonly tabs: Tab[] = [
    // Buscar es parte de Explorar, como en la app: al buscar la barra no se va.
    { route: '/', also: ['/buscar'], icon: 'explore', label: 'Explorar' },
    // Un reloj y no un calendario: una cita es una hora, no un mes. Mismo
    // criterio que la app.
    { route: '/citas', icon: 'schedule', label: 'Mis citas' },
    { route: '/mensajes', icon: 'chat_bubble', label: 'Chat', badge: true },
  ];

  unread = 0;

  /** Índice de la pestaña abierta, o -1 si esta pantalla no lleva barra. */
  active = -1;

  // ----- BLOB --------------------
  //
  // Posición continua, no un índice entero: mientras se arrastra vale 1.37 y
  // el blob está entre dos pestañas, que es de donde sale el efecto.
  pos = 0;
  scale = 1;
  dragging = false;
  private moved = false;
  private tabWidth = 0;

  private subs = new Subscription();
  private observer?: ResizeObserver;

  get visible(): boolean {
    return this.active >= 0;
  }

  /** Alto del blob: 52 de la app, estirado por la escala. */
  get blobHeight(): number {
    return 52 * this.scale;
  }

  /**
   * Ancho del blob.
   *
   * `scale + (scale - 1) * 0.3` es literal de la app: se ensancha un 30 % más
   * de lo que se agranda, y eso es lo que lo hace parecer una gota y no un
   * rectángulo que crece.
   */
  get blobWidth(): number {
    return Math.max(0, this.tabWidth - 12) * (this.scale + (this.scale - 1) * 0.3);
  }

  get blobLeft(): number {
    return this.pos * this.tabWidth + (this.tabWidth - this.blobWidth) / 2;
  }

  ngOnInit(): void {
    this.syncActive(this.router.url);
    this.subs.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => this.syncActive(e.urlAfterRedirects)),
    );

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
    this.observer?.disconnect();
    this.subs.unsubscribe();
    this.active = -1;
    this.publishSpace();
  }

  @HostListener('window:resize')
  measure(): void {
    const width = this.pill?.nativeElement.clientWidth ?? 0;
    this.tabWidth = width / this.tabs.length;
  }

  // ----- GESTO --------------------

  onPointerDown(event: PointerEvent): void {
    if (!this.visible || event.button !== 0) {
      return;
    }
    this.measure();
    this.dragging = true;
    this.moved = false;
    this.scale = PRESS_SCALE;
    this.pos = this.indexFromX(event);
    // La captura va en la píldora, no en el destino del toque: así el dedo
    // puede salirse del botón —o de la barra— sin perder el arrastre.
    //
    // ⚠️ Y NADA de escuchar `pointerleave` para cancelar: capturar el puntero
    // hace que el navegador dispare `pointerleave` sobre la cadena anterior en
    // ese mismo instante, así que el arrastre se cancelaba solo nada más
    // empezar y la gota no se movía del sitio.
    this.pill?.nativeElement.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    const next = this.indexFromX(event);
    if (Math.abs(next - this.pos) > 0.02) {
      this.moved = true;
    }
    this.pos = next;
  }

  onPointerUp(): void {
    if (!this.dragging) {
      return;
    }
    const target = Math.round(this.pos);
    this.dragging = false;
    this.scale = 1;
    this.pos = target;
    if (this.active !== target) {
      void this.router.navigate([this.tabs[target].route]);
    }
  }

  onPointerCancel(): void {
    this.dragging = false;
    this.scale = 1;
    this.pos = Math.max(0, this.active);
  }

  /**
   * El clic del enlace sobra cuando ha habido arrastre: `pointerup` ya ha
   * navegado. Se cancela en fase de captura porque la de burbujeo corre
   * después de que el `routerLink` haya hecho lo suyo.
   */
  @HostListener('click', ['$event'])
  onClickCapture(event: MouseEvent): void {
    if (this.moved) {
      event.preventDefault();
      event.stopPropagation();
      this.moved = false;
    }
  }

  private indexFromX(event: PointerEvent): number {
    const box = this.pill?.nativeElement.getBoundingClientRect();
    if (!box || !this.tabWidth) {
      return this.pos;
    }
    const raw = (event.clientX - box.left) / this.tabWidth - 0.5;
    return Math.min(this.tabs.length - 1, Math.max(0, raw));
  }

  // ----- ESTADO --------------------

  /**
   * El hueco inferior que las pantallas tienen que dejarse.
   *
   * Lo publica la barra y no una regla fija porque es la única que sabe si se
   * está pintando: en el hilo de chat, el perfil o la ficha no hay barra, y
   * ahí ese hueco es un agujero al final de la pantalla.
   */
  private publishSpace(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty(
      '--tabbar-space',
      this.visible ? 'calc(104px + env(safe-area-inset-bottom, 0px))' : '0px',
    );
  }

  private syncActive(url: string): void {
    const path = url.split('?')[0];
    // Coincidencia exacta, no `startsWith`: `/mensajes/12` es el hilo, que en
    // la app va fuera del shell y no lleva barra.
    const index = this.tabs.findIndex(tab => path === tab.route || !!tab.also?.includes(path));
    this.active = index;
    if (index >= 0 && !this.dragging) {
      this.pos = index;
    }
    this.publishSpace();
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
