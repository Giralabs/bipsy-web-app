import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { firebaseConfig, isWebPushConfigured, webPushVapidKey } from '../../environments/firebase.config';

/** En qué punto está el permiso de avisos de este navegador. */
export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

/**
 * Avisos push en el navegador. Equivale a `fcm_service.dart` de la app.
 *
 * El backend no ha necesitado ningún cambio: `Platform.WEB` ya existía y el
 * envío (`Message.setToken` + `Notification`) es el mismo para los tres
 * sitios. Lo único propio de la web es conseguir el token, que exige un
 * *service worker* servido desde la raíz (`public/firebase-messaging-sw.js`).
 *
 * ⚠️ **Sin la clave VAPID no se ofrece.** Pedirle permiso al navegador para
 * mandar avisos que después no van a llegar es peor que no ofrecerlo: el
 * permiso denegado no se vuelve a preguntar, y quien lo deniegue una vez se
 * queda sin avisos para siempre.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly api = inject(ApiService);

  /** Token registrado en esta pestaña, para poder darlo de baja al salir. */
  private currentToken: string | null = null;

  get state(): PushState {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      return 'unsupported';
    }
    if (!isWebPushConfigured()) {
      return 'unconfigured';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    return Notification.permission === 'granted' && this.currentToken ? 'on' : 'off';
  }

  get isAvailable(): boolean {
    const state = this.state;
    return state !== 'unsupported' && state !== 'unconfigured';
  }

  /**
   * Pide permiso, saca el token y lo registra en la cuenta.
   *
   * Devuelve si quedó encendido. No lanza: en Ajustes esto es un interruptor,
   * y un interruptor que estalla es peor que uno que se queda apagado.
   */
  async enable(): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
        import('firebase/app'),
        import('firebase/messaging'),
      ]);
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

      // El service worker se registra a mano para poder darle una ruta
      // explícita: servido desde otro sitio, FCM no lo encuentra.
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(getMessaging(app), {
        vapidKey: webPushVapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!token) {
        return false;
      }

      await this.api.post('/me/devices', { token, platform: 'WEB' });
      this.currentToken = token;
      return true;
    } catch {
      // Un navegador en modo privado, un permiso revocado a mitad o un service
      // worker bloqueado por la política del sitio: nada de eso es un error
      // que el usuario pueda arreglar leyendo un mensaje técnico.
      return false;
    }
  }

  /**
   * Da de baja este navegador.
   *
   * Se llama también al cerrar sesión: si no, el siguiente que entre en este
   * ordenador recibiría los avisos del anterior.
   */
  async disable(): Promise<void> {
    const token = this.currentToken;
    if (!token) {
      return;
    }
    this.currentToken = null;
    try {
      await this.api.delete(`/me/devices/${encodeURIComponent(token)}`);
    } catch {
      // Si la baja falla, el token acaba muriendo solo: el backend borra los
      // que FCM devuelve como UNREGISTERED.
    }
  }
}
