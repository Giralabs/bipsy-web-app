import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { MaintenanceStatus, MaintenanceUnlock } from '../models/bipsy.models';

/** Cómo se llama esta web para el servidor. El panel de negocio es otro sitio. */
const SITE = 'CUSTOMER_WEB';

/** La cabecera en la que viaja el pase del equipo. */
const TOKEN_HEADER = 'X-Bipsy-Maintenance';

/**
 * El interruptor de mantenimiento de la web.
 *
 * Las dos llamadas son públicas: se hacen antes de saber si hay sesión, y la
 * primera, además, antes de pintar nada que dependa de ella.
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceRepository {
  private readonly api = inject(ApiService);

  /**
   * Si la web está en mantenimiento.
   *
   * Con [token], el servidor dice también si ese pase sigue valiendo
   * (`bypass`). Sin él, o con uno caducado, `bypass` vuelve en falso.
   */
  status(token?: string | null): Promise<MaintenanceStatus> {
    return this.api.get<MaintenanceStatus>(
      '/maintenance/status',
      { site: SITE },
      false,
      token ? { [TOKEN_HEADER]: token } : undefined,
    );
  }

  /**
   * Cambia la contraseña del equipo por un pase.
   *
   * 404 si la web **no** está en mantenimiento —no hay nada que abrir—, 401 si
   * la contraseña no es, 429 si se ha probado demasiadas veces.
   */
  unlock(password: string): Promise<MaintenanceUnlock> {
    return this.api.post<MaintenanceUnlock>('/maintenance/unlock', { site: SITE, password }, false);
  }
}
