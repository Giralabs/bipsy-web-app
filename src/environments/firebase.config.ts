/**
 * Configuración web de Firebase (proyecto `gipsi-6806c`).
 *
 * Son los mismos valores que `DefaultFirebaseOptions.web` en la app de
 * cliente. **No son secretos**: la `apiKey` de Firebase identifica el
 * proyecto, no autoriza nada; quien protege la cuenta son las reglas del
 * proyecto y la lista de dominios autorizados.
 *
 * Solo se usa para el acceso con Google: el backend verifica un ID token de
 * Firebase (`FirebaseTokenVerifier`), así que la web tiene que emitirlo con
 * este mismo proyecto o el `aud` no cuadrará.
 *
 * ⚠️ Para que funcione en un dominio nuevo hay que añadirlo en
 * **Firebase Console → Authentication → Settings → Authorized domains**.
 * `localhost` ya viene autorizado de serie.
 */

/**
 * El dominio que Google enseña en «Ir a …» al elegir cuenta.
 *
 * Con el de Firebase, el selector de cuentas dice «Ir a
 * gipsi-6806c.firebaseapp.com», que no le suena a nadie y da mala espina justo
 * en el paso donde se entregan credenciales. Se arregla sirviendo el manejador
 * de Firebase desde el dominio propio: entonces dice «Ir a bipsy.es».
 *
 * **Cómo encenderlo** (los dos pasos, y en este orden):
 *
 *   1. Desplegar con el `vercel.json` de este repo, que reescribe
 *      `/__/auth/*` hacia `gipsi-6806c.firebaseapp.com`. Es lo que hace que
 *      el dominio propio sepa responder al retorno de Google.
 *   2. Firebase Console → Authentication → Settings → **Authorized domains**:
 *      añadir `bipsy.es`.
 *
 * Y entonces cambiar la constante de abajo a `'bipsy.es'`.
 *
 * ⚠️ **No cambiarla antes.** Si el dominio no sirve `/__/auth/handler`, el
 * acceso con Google deja de funcionar entero: la ventana vuelve a un 404 y no
 * hay token. Por eso queda en el de Firebase hasta que los dos pasos estén
 * hechos, y no se deduce del `location.host`.
 */
export const firebaseAuthDomain = 'gipsi-6806c.firebaseapp.com';

export const firebaseConfig = {
  apiKey: 'AIzaSyCZth_-nuG-bp2X4LlqB6vJsHmSCqmytzw',
  authDomain: firebaseAuthDomain,
  projectId: 'gipsi-6806c',
  storageBucket: 'gipsi-6806c.firebasestorage.app',
  messagingSenderId: '933645516812',
  appId: '1:933645516812:web:c66ddc95f50a2508ef2e29',
};

/**
 * Clave pública de Web Push (VAPID) del proyecto.
 *
 * **Hay que rellenarla a mano**: sale de Firebase Console → Configuración del
 * proyecto → Cloud Messaging → *Certificados push web* → "Par de claves".
 * Es pública, va en el navegador y no autoriza a enviar nada.
 *
 * Vacía, los avisos push no se ofrecen: la pantalla de Ajustes esconde la
 * opción en vez de pedir permiso al navegador para algo que después no va a
 * llegar. Mismo criterio que con Stripe y con Maps.
 */
export const webPushVapidKey =
  'BNiEukj_jux84qrui6_xuT2GA_z0r9ItRiQNvGCIqHxh6CvXMgASWZ7ZL9a0PwccfvYO75a0bnyBk5y5zqw8T9I';

export function isWebPushConfigured(): boolean {
  return isGoogleSignInConfigured() && webPushVapidKey.length > 0;
}

/**
 * Si se puede ofrecer el botón de Google.
 *
 * Se comprueba en vez de darlo por hecho para que un despliegue sin configurar
 * esconda la opción en lugar de enseñar un botón que siempre falla — el mismo
 * criterio que usan las apps con Stripe, Maps y Firebase.
 */
export function isGoogleSignInConfigured(): boolean {
  return firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId.length > 0;
}
