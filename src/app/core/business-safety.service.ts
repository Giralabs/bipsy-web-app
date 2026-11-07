import { Injectable, inject } from '@angular/core';
import { ApiError } from './api-error';
import { DialogService } from './dialog.service';
import { ToastService } from './toast.service';
import { MeRepository } from '../repositories/me.repository';

/** Lo que se eligió en el menú de la bandera. */
export type SafetyChoice = 'report' | 'blocked' | 'unblocked' | null;

/**
 * Reportar o bloquear a un negocio: lo que abre la bandera de su ficha y de su
 * chat. Port de `showBusinessSafetyMenu` y `setBusinessBlocked`.
 *
 * Un menú de acciones y no dos botones: los dos van juntos en cualquier app de
 * mensajes, y una segunda bandera en la cabecera no se entendería. Reportar lo
 * abre quien llama (cada pantalla monta su hoja); bloquear y desbloquear se
 * resuelven aquí.
 */
@Injectable({ providedIn: 'root' })
export class BusinessSafetyService {
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly me = inject(MeRepository);

  async openMenu(opts: { businessId: number; businessName: string; blocked: boolean }): Promise<SafetyChoice> {
    const choice = await this.dialog.actions({
      title: opts.businessName,
      actions: [
        { label: 'Reportar' },
        opts.blocked ? { label: 'Desbloquear' } : { label: 'Bloquear', destructive: true },
      ],
    });
    if (choice === null) return null;
    if (choice === 0) return 'report';
    return this.setBlocked({ ...opts, block: !opts.blocked });
  }

  /**
   * Bloquea (con confirmación) o desbloquea (directo: deshacer no tiene nada
   * que avisar). Devuelve el nuevo estado, o null si no cambió nada.
   */
  async setBlocked(opts: { businessId: number; businessName: string; block: boolean }): Promise<SafetyChoice> {
    if (opts.block) {
      const ok = await this.dialog.confirm({
        title: `¿Bloquear a ${opts.businessName}?`,
        message:
          'Dejará de salirte en Explorar, no podrás reservar y no podréis escribiros por el chat. ' +
          'Las citas que ya tienes no cambian: si quieres, cancélalas tú. Puedes desbloquearlo ' +
          'cuando quieras desde Ajustes → Negocios bloqueados.',
        confirmLabel: 'Bloquear',
        cancelLabel: 'Cancelar',
        destructive: true,
      });
      if (!ok) return null;
    }
    try {
      if (opts.block) {
        await this.me.blockBusiness(opts.businessId);
      } else {
        await this.me.unblockBusiness(opts.businessId);
      }
      this.toast.success(
        opts.block ? `Has bloqueado a ${opts.businessName}.` : `Has desbloqueado a ${opts.businessName}.`,
      );
      return opts.block ? 'blocked' : 'unblocked';
    } catch (raw) {
      this.toast.error(ApiError.from(raw).message);
      return null;
    }
  }
}
