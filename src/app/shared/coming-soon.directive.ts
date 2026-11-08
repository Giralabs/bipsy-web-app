import { Directive, HostListener, Input, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';

/**
 * Un enlace o botón a algo que todavía no existe: al pulsarlo dice
 * «Próximamente…» con el aviso flotante de la web, en vez de llevar a ningún
 * sitio.
 *
 * Antes esos enlaces apuntaban a youtube.com, heredado de una plantilla: un
 * distintivo de Google Play que abre YouTube es peor que uno que dice la verdad.
 *
 *   <a [href]="url" [comingSoon]="ready ? null : 'Próximamente en Google Play'">
 *
 * Con el mensaje vacío (o null) no hace nada y el enlace funciona normal: así
 * el día que exista basta con dejar de pasarlo.
 */
@Directive({
  selector: '[comingSoon]',
  standalone: true,
})
export class ComingSoonDirective {
  @Input('comingSoon') message: string | null | undefined = null;

  private readonly toast = inject(ToastService);

  @HostListener('click', ['$event'])
  onClick(event: Event): void {
    if (!this.message) return;
    event.preventDefault();
    event.stopPropagation();
    this.toast.info(this.message);
  }
}

/** Los textos, en un sitio: el mismo distintivo sale en el pie y en la portada. */
export const SOON = {
  googlePlay: 'Próximamente en Google Play',
  appStore: 'Próximamente en el App Store',
  instagram: 'Próximamente en Instagram',
  tiktok: 'Próximamente en TikTok',
} as const;
