import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';
import { NotificationPrefs } from '../models/profile-extras.models';

/**
 * Qué avisos quiere recibir la cuenta. Son de la CUENTA, no del dispositivo:
 * la decisión de mandar o no una push se toma en el servidor, así que lo que
 * se apague aquí vale también para el móvil.
 */
@Injectable({ providedIn: 'root' })
export class NotificationPrefsRepository {
  private readonly api = inject(ApiService);

  get(): Promise<NotificationPrefs> {
    return this.api.get<NotificationPrefs>('/me/notification-prefs');
  }

  /**
   * Solo las claves que cambian, nunca el conjunto entero: el servidor lo
   * trata como un parche para que un cliente viejo no encienda solo lo que no
   * conoce.
   */
  update(prefs: Record<string, boolean>): Promise<NotificationPrefs> {
    return this.api.put<NotificationPrefs>('/me/notification-prefs', { prefs });
  }
}
