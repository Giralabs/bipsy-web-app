import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Banda de la ficha de un negocio que el cliente ha bloqueado. Port de
 * `BlockedBanner`.
 *
 * Explica por qué «Pedir cita» está apagado y no hay chat, y desbloquea desde
 * aquí. Sin ella la ficha parecería rota: un botón gris sin motivo. Suelo
 * agrupado y no un tinte de color, como la app.
 */
@Component({
  selector: 'app-blocked-banner',
  standalone: true,
  template: `
    <div class="blocked" role="status">
      <span class="material-symbols-rounded blocked__icon" aria-hidden="true">block</span>
      <p class="blocked__text">
        Has bloqueado este negocio. No te sale en Explorar y no puedes reservar ni escribirle.
      </p>
      <button type="button" class="blocked__btn" [disabled]="busy" (click)="unblock.emit()">Desbloquear</button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .blocked {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      padding: 10px 8px 10px 16px;
      border-radius: var(--r-sm);
      background: var(--clr-surface);
    }
    .blocked__icon { font-size: 18px; color: var(--clr-text-2); }
    .blocked__text { flex: 1; font-size: .875rem; font-weight: 600; line-height: 1.4; color: var(--clr-text); }
    .blocked__btn {
      flex-shrink: 0;
      min-height: 44px;
      padding: 0 12px;
      border: none;
      border-radius: var(--r-xs);
      background: transparent;
      color: var(--clr-mint);
      font: inherit;
      font-size: .9375rem;
      font-weight: 700;
      cursor: pointer;
    }
    .blocked__btn:hover { background: var(--clr-field); }
    .blocked__btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
    .blocked__btn:disabled { opacity: .5; cursor: default; }
  `],
})
export class BlockedBannerComponent {
  @Input() busy = false;
  @Output() unblock = new EventEmitter<void>();
}
