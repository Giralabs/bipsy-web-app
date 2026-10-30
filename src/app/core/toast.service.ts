import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/**
 * Los avisos flotantes de la web. Port del `SnackBar` de la app.
 *
 * Uno a la vez, abajo y centrado (sobre la barra de pestañas en el móvil), y
 * se van solos. Antes cada página pintaba el suyo, y las que no tenían se
 * quedaban abiertas después de hacer algo en vez de decirlo y seguir.
 *
 * Lo pinta `<app-toast-host>`, montado una sola vez en la raíz.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);

  private seq = 0;
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string, tone: ToastTone = 'success', ms = 3200): void {
    clearTimeout(this.timer);
    this.current.set({ id: ++this.seq, message, tone });
    this.timer = setTimeout(() => this.current.set(null), ms);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void { this.show(message, 'error', 4500); }
  info(message: string): void { this.show(message, 'info'); }
}
