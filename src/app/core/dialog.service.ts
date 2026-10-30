import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message?: string;
  /** Lo que hace el botón principal, dicho como acción: «Cancelar cita», no «Aceptar». */
  confirmLabel: string;
  /** El otro botón. Por defecto «Volver»: «Cancelar» confunde cuando lo que se confirma es cancelar. */
  cancelLabel?: string;
  /** Algo que no se puede deshacer: el botón sale en rojo. */
  destructive?: boolean;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * Los diálogos de confirmación de la web. Port de `GipsiAlert.confirm`.
 *
 * Sustituye al `confirm()` del navegador, que sacaba una ventanita gris del
 * sistema —con «localhost dice…» de título— justo en los momentos que más
 * importan: cancelar una cita, quitar una tarjeta, borrar una reseña.
 *
 * Lo pinta `<app-confirm-dialog>`, montado una sola vez en la raíz.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<Pending | null>(null);

  /** Abre el diálogo y resuelve `true` si se confirma. */
  confirm(request: ConfirmRequest): Promise<boolean> {
    // Uno a la vez: si ya había uno abierto, se da por cancelado.
    this.current()?.resolve(false);
    return new Promise(resolve => this.current.set({ ...request, resolve }));
  }

  /** Lo llama el diálogo al cerrarse. */
  settle(ok: boolean): void {
    const pending = this.current();
    if (!pending) return;
    this.current.set(null);
    pending.resolve(ok);
  }
}
