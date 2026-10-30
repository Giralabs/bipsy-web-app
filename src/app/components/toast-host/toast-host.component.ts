import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/toast.service';

const ICONS = { success: 'check_circle', error: 'error', info: 'info' } as const;

/**
 * Pinta el aviso de `ToastService`. Usa la clase global `.toast`.
 *
 * Región `status` siempre presente —aunque vacía— para que el lector de
 * pantalla anuncie cada aviso nuevo: una región que aparece a la vez que su
 * texto no la lee casi ningún lector.
 */
@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div role="status" aria-live="polite" class="toast-live">
      @if (toasts.current(); as t) {
        @for (x of [t.id]; track x) {
          <div class="toast" [class.toast--error]="t.tone === 'error'">
            <span class="material-symbols-rounded fill">{{ icon(t.tone) }}</span>{{ t.message }}
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .toast-live { position: fixed; inset: auto 0 0; pointer-events: none; z-index: 1100; }
    .toast { pointer-events: auto; }
    .toast--error .material-symbols-rounded { color: var(--clr-danger-text); }
  `],
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);

  icon(tone: keyof typeof ICONS): string {
    return ICONS[tone];
  }
}
