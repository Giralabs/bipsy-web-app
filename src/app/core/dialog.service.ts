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
  /**
   * Solo informa: un botón y nada más (`GipsiAlert.info`). Para cuando no hay
   * nada que elegir, como explicar cómo reactivar un permiso del navegador.
   */
  infoOnly?: boolean;
}

export interface ActionChoice {
  label: string;
  /** Sale en rojo, como el `destructiveIndex` de `GipsiAlert.actions`. */
  destructive?: boolean;
}

export interface ActionsRequest {
  title: string;
  message?: string;
  actions: ActionChoice[];
  /** El botón de salir. Por defecto «Cancelar», como la hoja de acciones de iOS. */
  cancelLabel?: string;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

interface PendingActions extends ActionsRequest {
  resolve: (index: number | null) => void;
}

/**
 * Los diálogos de confirmación de la web. Port de `GipsiAlert.confirm` y
 * `GipsiAlert.actions`.
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
  readonly currentActions = signal<PendingActions | null>(null);

  /** Abre el diálogo y resuelve `true` si se confirma. */
  confirm(request: ConfirmRequest): Promise<boolean> {
    // Uno a la vez: si ya había uno abierto, se da por cancelado.
    this.dismissAll();
    return new Promise(resolve => this.current.set({ ...request, resolve }));
  }

  /** Aviso de un solo botón. Resuelve al cerrarse. */
  async info(request: { title: string; message?: string; closeLabel?: string }): Promise<void> {
    await this.confirm({
      title: request.title,
      message: request.message,
      confirmLabel: request.closeLabel ?? 'Entendido',
      infoOnly: true,
    });
  }

  /**
   * Hoja de acciones: resuelve con el índice de la elegida, o null si se
   * cancela. Para menús cortos como «Reportar · Bloquear».
   */
  actions(request: ActionsRequest): Promise<number | null> {
    this.dismissAll();
    return new Promise(resolve => this.currentActions.set({ ...request, resolve }));
  }

  /** Lo llama el diálogo al cerrarse. */
  settle(ok: boolean): void {
    const pending = this.current();
    if (!pending) return;
    this.current.set(null);
    pending.resolve(ok);
  }

  /** Lo llama la hoja de acciones al cerrarse. */
  settleAction(index: number | null): void {
    const pending = this.currentActions();
    if (!pending) return;
    this.currentActions.set(null);
    pending.resolve(index);
  }

  private dismissAll(): void {
    this.settle(false);
    this.settleAction(null);
  }
}
