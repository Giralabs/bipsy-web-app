import { environment } from './environment';

/**
 * Configuración web de Firebase (proyecto `gipsi-6806c`).
 *
 * Son los mismos valores que `DefaultFirebaseOptions.web` en la app de
 * cliente. **No son secretos**: la `apiKey` de Firebase identifica el
 * proyecto, no autoriza nada; quien protege la cuenta son las reglas del
 * proyecto y la lista de dominios autorizados.
 *
 * Se usa para el acceso con Google y con Apple: el backend verifica un ID token
 * de Firebase (`FirebaseTokenVerifier`), así que la web tiene que emitirlo con
 * este mismo proyecto o el `aud` no cuadrará.
 *
 * ⚠️ Para que funcione en un dominio nuevo hay que añadirlo en
 * **Firebase Console → Authentication → Settings → Authorized domains**.
 * `localhost` ya viene autorizado de serie.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyCZth_-nuG-bp2X4LlqB6vJsHmSCqmytzw',
  // Sale del entorno: producción y desarrollo no pueden usar el mismo.
  authDomain: environment.firebaseAuthDomain,
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

/**
 * Si se puede ofrecer el botón de Apple.
 *
 * En la app Apple **solo sale en iOS** (en Android iría por una ventana web,
 * que es un flujo peor). En un navegador esa distinción no existe: el flujo es
 * la misma ventana emergente para todos, así que se ofrece siempre.
 *
 * ⚠️ En el navegador Apple NO va por la hoja del sistema sino por su OAuth
 * web, y eso pide config aparte de la de las apps:
 *
 *  1. **Apple Developer → Identifiers → Services IDs**: un Services ID con
 *     *Sign in with Apple* activado.
 *  2. En ese Services ID, «Return URLs» tiene que incluir
 *     `https://<authDomain>/__/auth/handler` — hoy
 *     `https://gipsi-6806c.firebaseapp.com/__/auth/handler`.
 *  3. **Firebase Console → Authentication → Sign-in method → Apple**:
 *     el proveedor activado, con ese Services ID y la clave `.p8` (Key ID +
 *     Team ID).
 *
 * Sin los tres pasos, Firebase responde `auth/operation-not-allowed` o
 * `invalid_client`, y el servicio lo cuenta como "no disponible" en vez de
 * como un fallo del usuario.
 *
 * El Services ID se agrupa bajo el App ID de la app de cliente
 * (`com.gipsi.gipsi`) para que Apple emita **el mismo identificador de
 * usuario** que en el móvil. Con otro grupo, quien ya entró con Apple desde el
 * iPhone llegaría aquí como alguien distinto y se encontraría una cuenta
 * vacía.
 *
 * El gemelo de esta constante está en
 * `bipsy-business-web-app/src/app/panel/core/auth/firebase.config.ts`: los dos
 * leen el mismo proyecto de Firebase, así que van a la vez. Ponerla a `false`
 * esconde el botón, que es lo que hay que hacer si algún día se cae la
 * configuración: mejor sin opción que con una que siempre falla.
 */
export const appleSignInEnabled = true;

export function isAppleSignInConfigured(): boolean {
  return appleSignInEnabled && isGoogleSignInConfigured();
}
