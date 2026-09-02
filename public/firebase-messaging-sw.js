/* Service worker de los avisos push.
 *
 * Tiene que vivir en la RAÍZ del sitio y llamarse exactamente así: es donde lo
 * busca el SDK de Firebase cuando no se le pasa uno a mano.
 *
 * Un service worker no puede importar módulos ni leer el `environment` de
 * Angular, así que la configuración va escrita aquí. Son los mismos valores
 * públicos de `src/environments/firebase.config.ts`; si cambian allí, cambian
 * aquí.
 *
 * Solo se ocupa de los avisos que llegan con la pestaña cerrada o en segundo
 * plano. Los de primer plano los pinta la propia página.
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCZth_-nuG-bp2X4LlqB6vJsHmSCqmytzw',
  authDomain: 'gipsi-6806c.firebaseapp.com',
  projectId: 'gipsi-6806c',
  storageBucket: 'gipsi-6806c.firebasestorage.app',
  messagingSenderId: '933645516812',
  appId: '1:933645516812:web:c66ddc95f50a2508ef2e29',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'Bipsy', {
    body: notification.body,
    icon: '/assets_bipsy/Brand Marks/brandmark_mint.webp',
    // El destino viaja en los datos del mensaje: es lo que decide a dónde
    // lleva el clic.
    data: { url: (payload.data && payload.data.route) || '/home' },
  });
});

// Un aviso que no lleva a ninguna parte no sirve de nada: si ya hay una
// pestaña de Bipsy abierta se enfoca esa, y si no se abre una.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
