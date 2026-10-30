import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';

/** Una foto del visor, con la URL ya resuelta contra la API. */
export interface PortfolioViewerImage {
  id: number;
  url: string;
  caption?: string;
  serviceName?: string;
}

/** Lo que hay que arrastrar de lado para pasar de foto. */
const SWIPE_PX = 48;

/**
 * La galería de la ficha, ampliada. Port de `showPortfolioViewer`.
 *
 * Como en la app, la foto se amplía SOBRE la ficha —que sigue detrás, oscura y
 * desenfocada— y no en una pantalla negra: una foto apaisada se quedaba allí
 * en una franja en mitad de la nada. Sin zoom, por lo mismo que la app: las
 * fotos se miran, no se inspeccionan, y el zoom se peleaba con pasar y cerrar.
 *
 * Se pasa de foto con las flechas (botones o teclado) y arrastrando de lado en
 * pantallas táctiles; se cierra con Escape, con la X o tocando fuera de la foto.
 * Es un diálogo de verdad: el foco entra al abrir, no se escapa con el
 * tabulador y vuelve a la miniatura al cerrar.
 */
@Component({
  selector: 'app-portfolio-viewer',
  standalone: true,
  templateUrl: './portfolio-viewer.component.html',
  styleUrl: './portfolio-viewer.component.css',
})
export class PortfolioViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) images: PortfolioViewerImage[] = [];
  @Input() initialIndex = 0;
  /** Para el nombre del diálogo y el texto alternativo sin pie. */
  @Input() businessName = '';

  @Output() closed = new EventEmitter<void>();

  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  index = 0;
  private touchStartX: number | null = null;
  private touchStartY = 0;
  private readonly returnFocus =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  ngOnInit(): void {
    this.index = Math.min(Math.max(this.initialIndex, 0), Math.max(this.images.length - 1, 0));
  }

  ngAfterViewInit(): void {
    this.closeBtn?.nativeElement.focus();
    // La ficha de detrás no se desplaza mientras se mira la foto.
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.returnFocus?.focus?.();
  }

  get current(): PortfolioViewerImage | undefined {
    return this.images[this.index];
  }

  get total(): number {
    return this.images.length;
  }

  get hasPrev(): boolean {
    return this.index > 0;
  }

  get hasNext(): boolean {
    return this.index < this.images.length - 1;
  }

  /** Sin dar la vuelta: al llegar a la última, la flecha se apaga, como el PageView. */
  prev(): void {
    if (this.hasPrev) this.index--;
  }

  next(): void {
    if (this.hasNext) this.index++;
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        return;
      case 'ArrowLeft':
        event.preventDefault();
        this.prev();
        return;
      case 'ArrowRight':
        event.preventDefault();
        this.next();
        return;
      case 'Tab':
        this.trapFocus(event);
    }
  }

  /** Tocar fuera de la foto y de los botones cierra, como en la app. */
  onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget || (event.target as HTMLElement).dataset['close'] !== undefined) {
      this.closed.emit();
    }
  }

  onTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.touchStartX = touch?.clientX ?? null;
    this.touchStartY = touch?.clientY ?? 0;
  }

  /**
   * Arrastrar de lado pasa de foto. Solo si el gesto es más horizontal que
   * vertical: un arrastre hacia abajo no es «la siguiente».
   */
  onTouchEnd(event: TouchEvent): void {
    if (this.touchStartX === null) return;
    const touch = event.changedTouches[0];
    const dx = (touch?.clientX ?? this.touchStartX) - this.touchStartX;
    const dy = (touch?.clientY ?? this.touchStartY) - this.touchStartY;
    this.touchStartX = null;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) this.next();
    else this.prev();
  }

  private trapFocus(event: KeyboardEvent): void {
    const root = this.dialog?.nativeElement;
    if (!root) return;
    const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled])'));
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
