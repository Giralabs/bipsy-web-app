import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

/** Desplazamiento y velocidad a partir de los que soltar cierra (los de la app). */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.7; // px/ms = 700 px/s
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * La foto del chat a pantalla completa. Port de `GipsiChatViewer`.
 *
 * Fondo negro también en tema claro: una foto se mira mejor sobre negro y es
 * lo que hace cualquier visor. Arriba el nombre, cerrar y descargar; en la app
 * es «Guardar o compartir» con la hoja del sistema, que en un navegador es
 * sencillamente una descarga.
 *
 * Los gestos son los de la app: **pellizcar, rueda o doble toque amplían**
 * (de 1× a 5×, como su `InteractiveViewer`) y, ampliada, arrastrar mueve la
 * foto. **Sin ampliar, deslizar en vertical cierra**: con la foto ampliada eso
 * no puede pasar, o no habría forma de moverse por ella.
 *
 * Es un diálogo de verdad: se anuncia como tal, se cierra con Escape, el foco
 * entra en él al abrir y vuelve a donde estaba al cerrar, y el tabulador no se
 * escapa al hilo que hay detrás.
 */
@Component({
  selector: 'app-chat-viewer',
  standalone: true,
  templateUrl: './chat-viewer.component.html',
  styleUrl: './chat-viewer.component.css',
})
export class ChatViewerComponent implements AfterViewInit, OnDestroy {
  /** URL de objeto ya descargada: abrir no vuelve a bajar el archivo. */
  @Input({ required: true }) url!: string;
  @Input() filename = 'Imagen';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  scale = 1;
  panX = 0;
  panY = 0;
  /** Lo arrastrado en vertical sin zoom, para cerrar. */
  dragY = 0;
  /** Sin transición mientras el dedo manda; con ella al volver a su sitio. */
  gesturing = false;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; scale: number } | null = null;
  private dragStart: { y: number; t: number } | null = null;
  private lastTap = 0;
  /** Un arrastre no puede acabar como «tocar fuera» y cerrar. */
  private moved = false;
  /**
   * Dónde empezó el toque. Con `setPointerCapture` el `click` llega a la
   * superficie aunque se tocara la foto, y el doble toque para ampliar se
   * tomaba por «tocar fuera» y cerraba el visor.
   */
  private downOnImage = false;

  private readonly returnFocus =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  get zoomed(): boolean {
    return this.scale > 1.01;
  }

  get transform(): string {
    return `translate3d(${this.panX}px, ${this.panY + this.dragY}px, 0) scale(${this.scale})`;
  }

  /** Lo que se mira se apaga al arrastrar: así el gesto se siente como cerrar. */
  get opacity(): number {
    const progress = Math.min(1, Math.abs(this.dragY) / (DISMISS_DISTANCE * 2));
    return 0.4 + (1 - progress) * 0.6;
  }

  ngAfterViewInit(): void {
    this.closeBtn?.nativeElement.focus();
    // Lo de detrás no se desplaza mientras se mira la foto.
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.returnFocus?.focus?.();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** Tocar fuera de la foto cierra: es lo primero que se intenta. */
  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.moved && !this.downOnImage) {
      this.closed.emit();
    }
  }

  // ── Gestos ──

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const next = this.clampScale(this.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
    this.zoomAt(next, event.clientX, event.clientY);
  }

  onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.gesturing = true;
    this.moved = false;
    this.downOnImage = (event.target as HTMLElement).tagName === 'IMG';
    if (this.pointers.size === 2) {
      this.pinchStart = { dist: this.pointerDistance(), scale: this.scale };
      this.dragStart = null;
    } else if (this.pointers.size === 1) {
      this.dragStart = { y: event.clientY, t: performance.now() };
    }
  }

  onPointerMove(event: PointerEvent): void {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;

    if (this.pointers.size === 2 && this.pinchStart) {
      const next = this.clampScale(this.pinchStart.scale * (this.pointerDistance() / this.pinchStart.dist));
      const [a, b] = [...this.pointers.values()];
      this.zoomAt(next, (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (this.pointers.size !== 1) return;
    if (this.zoomed) {
      this.panX += dx;
      this.panY += dy;
    } else {
      this.dragY += dy;
    }
  }

  onPointerUp(event: PointerEvent): void {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 1) {
      // De pellizcar a un dedo: sigue moviendo, sin cerrar.
      this.pinchStart = null;
      this.dragStart = null;
      return;
    }
    if (this.pointers.size > 0) return;
    this.gesturing = false;
    this.pinchStart = null;

    if (!this.zoomed && this.dragStart) {
      const elapsed = Math.max(1, performance.now() - this.dragStart.t);
      const fast = Math.abs(this.dragY) / elapsed > DISMISS_VELOCITY;
      if (Math.abs(this.dragY) > DISMISS_DISTANCE || (fast && Math.abs(this.dragY) > 24)) {
        this.closed.emit();
        return;
      }
    }
    this.dragStart = null;
    // Soltar a medias no puede dejar la foto torcida.
    this.dragY = 0;
    if (!this.zoomed) this.resetZoom();

    if (!this.moved) this.onTap(event);
  }

  /** Doble toque: amplía donde se ha tocado, o vuelve a 1×. */
  private onTap(event: PointerEvent): void {
    const now = performance.now();
    if (now - this.lastTap < 300) {
      this.lastTap = 0;
      if (this.zoomed) this.resetZoom();
      else this.zoomAt(DOUBLE_TAP_SCALE, event.clientX, event.clientY);
    } else {
      this.lastTap = now;
    }
  }

  /** Cambia la escala manteniendo quieto el punto (cx, cy) de la pantalla. */
  private zoomAt(next: number, cx: number, cy: number): void {
    const ox = cx - window.innerWidth / 2;
    const oy = cy - window.innerHeight / 2;
    const ratio = next / this.scale;
    this.panX = ox - (ox - this.panX) * ratio;
    this.panY = oy - (oy - this.panY) * ratio;
    this.scale = next;
    if (!this.zoomed) this.resetZoom();
  }

  private resetZoom(): void {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  private clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(1, s));
  }

  private pointerDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  /** El tabulador da la vuelta dentro del visor en vez de salir al hilo. */
  private trapFocus(event: KeyboardEvent): void {
    const root = this.dialog?.nativeElement;
    if (!root) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
