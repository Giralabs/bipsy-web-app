import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Una foto que llega de la red aparece fundiéndose, en vez de pintarse de
 * golpe —o a trozos, de arriba abajo— sobre el hueco gris de la tarjeta.
 *
 * Si ya estaba en la caché del navegador (`complete` al montarse), sale sin
 * fundido: volver atrás y ver cómo se desvanecen otra vez fotos que ya estaban
 * es peor que no animar nada. Si falla, también se enseña: el hueco que deja
 * una foto rota lo resuelve quien la pinta, no un `opacity: 0` para siempre.
 *
 *   <img appImgFade [src]="url" />
 */
@Directive({
  selector: 'img[appImgFade]',
  standalone: true,
  host: { class: 'img-fade' },
})
export class ImgFadeDirective implements OnInit, OnDestroy {
  private readonly img = inject(ElementRef<HTMLImageElement>).nativeElement as HTMLImageElement;

  private readonly show = () => this.img.classList.add('is-loaded');

  ngOnInit(): void {
    if (this.img.complete && this.img.naturalWidth > 0) {
      this.show();
      return;
    }
    this.img.addEventListener('load', this.show);
    this.img.addEventListener('error', this.show);
  }

  ngOnDestroy(): void {
    this.img.removeEventListener('load', this.show);
    this.img.removeEventListener('error', this.show);
  }
}
