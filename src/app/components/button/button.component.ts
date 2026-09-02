import { Component, HostBinding, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './button.component.html',
  styleUrl: './button.component.css'
})
export class ButtonComponent {
  @Input() label: string = '';
  @Input() variant: 'primary' | 'secondary' | 'ghost' | 'text' | 'destructive' = 'primary';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() icon?: string;
  @Input() trailingIcon?: string;
  @Input() loading: boolean = false;
  @Input() disabled: boolean = false;
  @Input() fullWidth: boolean = false;
  @Input() routerLink?: any[] | string;
  @Input() href?: string;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  /**
   * El botón se apoya sobre una superficie BLANCA —una tarjeta, una hoja— en
   * vez de sobre el fondo de pantalla.
   *
   * Solo importa a la variante `secondary`: sobre el fondo el relleno es el de
   * tarjeta, para que destaque igual que una; sobre una tarjeta eso lo haría
   * invisible, así que ahí baja al gris de campo.
   */
  @Input() overCard: boolean = false;

  @Output() onClick = new EventEmitter<MouseEvent>();

  /**
   * Un elemento desconocido cae en `display: inline`, así que el botón se
   * apoyaba en una línea de texto y arrastraba el hueco del descendente:
   * aparecían 6-8 px de aire por encima y por debajo que no venía de ningún
   * margen y no había forma de quitar desde fuera.
   */
  @HostBinding('style.display')
  get hostDisplay(): string {
    return this.fullWidth ? 'block' : 'inline-flex';
  }

  get buttonClass(): string {
    const onCard = this.overCard ? ' bipsy-btn--on-card' : '';
    return `bipsy-btn bipsy-btn--${this.variant} bipsy-btn--${this.size}${onCard}`;
  }

  onBtnClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.onClick.emit(event);
    }
  }
}
