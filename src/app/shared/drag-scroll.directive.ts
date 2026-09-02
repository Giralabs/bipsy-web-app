import { Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/**
 * Arrastrar una fila horizontal con el ratón.
 *
 * En el móvil se desliza con el dedo y ya está; en un ordenador, una fila que
 * se sale por la derecha solo se puede mover con la rueda lateral o con una
 * barra que no se ve, así que la mitad de las categorías eran inalcanzables.
 *
 * ⚠️ **Arrastrar no puede activar lo que hay debajo.** Un `click` normal sobre
 * una pastilla la elige; si además se ha movido el ratón, el clic se anula en
 * fase de captura: sin eso, cada arrastre acababa filtrando por la categoría
 * donde soltabas.
 */
@Directive({
  selector: '[appDragScroll]',
  standalone: true,
})
export class DragScrollDirective implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

  private dragging = false;
  private moved = false;
  private startX = 0;
  private startScroll = 0;

  /** Por debajo de esto es un clic tembloroso, no un arrastre. */
  private static readonly THRESHOLD = 4;

  /**
   * El clic se anula en **fase de captura**.
   *
   * `@HostListener('click')` llega en fase de burbuja, o sea DESPUÉS de que la
   * pastilla haya ejecutado el suyo: para entonces ya se había filtrado por la
   * categoría donde soltabas. En captura se llega antes que nadie.
   */
  private readonly onCaptureClick = (event: Event) => {
    if (this.moved) {
      event.stopPropagation();
      event.preventDefault();
      this.moved = false;
    }
  };

  constructor() {
    this.host.addEventListener('click', this.onCaptureClick, true);
  }

  ngOnDestroy(): void {
    this.host.removeEventListener('click', this.onCaptureClick, true);
  }

  @HostListener('pointerdown', ['$event'])
  onDown(event: PointerEvent): void {
    // La rueda pulsada abre el desplazamiento automático del navegador: un
    // cursor de flechas que mueve la página entera y que además pelea con
    // nuestro manejo de la rueda. Sobre una fila horizontal no tiene sentido.
    if (event.button === 1) {
      event.preventDefault();
      return;
    }
    // Solo el botón principal, y no con el dedo: el táctil ya se desliza solo
    // y capturarlo aquí rompería el desplazamiento nativo.
    if (event.button !== 0 || event.pointerType === 'touch') {
      return;
    }
    this.dragging = true;
    this.moved = false;
    this.startX = event.clientX;
    this.startScroll = this.host.scrollLeft;
    this.host.classList.add('is-dragging');
  }

  @HostListener('pointermove', ['$event'])
  onMove(event: PointerEvent): void {
    if (!this.dragging) {
      return;
    }
    const delta = event.clientX - this.startX;
    if (Math.abs(delta) > DragScrollDirective.THRESHOLD) {
      this.moved = true;
      // Sin esto el navegador arranca su propio arrastre de la imagen o del
      // texto que haya bajo el cursor.
      event.preventDefault();
    }
    this.host.scrollLeft = this.startScroll - delta;
  }

  /** El clic auxiliar tampoco: es la otra mitad del desplazamiento automático. */
  @HostListener('auxclick', ['$event'])
  onAuxClick(event: MouseEvent): void {
    if (event.button === 1) {
      event.preventDefault();
    }
  }

  @HostListener('pointerup')
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  onUp(): void {
    this.dragging = false;
    this.host.classList.remove('is-dragging');
  }

  /** La rueda vertical mueve la fila: es lo que espera un ratón normal. */
  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    // Con Ctrl la rueda es el zoom del navegador, y con Shift ya desplaza en
    // horizontal por su cuenta: en los dos casos aquí no pintamos nada.
    if (event.ctrlKey || event.shiftKey) {
      return;
    }
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    const max = this.host.scrollWidth - this.host.clientWidth;
    if (max <= 0) {
      return;
    }
    const next = this.host.scrollLeft + event.deltaY;
    // Solo se roba la rueda mientras quede fila por recorrer: al llegar al
    // final tiene que seguir desplazándose la página.
    if (next > 0 && next < max) {
      event.preventDefault();
      this.host.scrollLeft = next;
    }
  }
}
