/**
 * Configuración de producción.
 *
 * Mismo criterio que el `core/env.dart` de cada app: la URL por defecto es la
 * de producción, y el desarrollo la sustituye (ver `fileReplacements` en
 * angular.json).
 */
export const environment = {
  production: true,
  apiUrl: 'https://gipsi-api.onrender.com',

  /**
   * El dominio del acceso con Google. Es lo que se lee en «Ir a …» cuando
   * Google pide elegir cuenta.
   *
   * ⚠️ **Cambiar a `'bipsy.es'` SOLO cuando el dominio esté sirviendo desde
   * Vercel con el `vercel.json` de este repo.** Ese fichero reescribe
   * `/__/auth/*` hacia Firebase, y es lo que hace que bipsy.es sepa responder
   * al retorno de Google. Comprobación de un comando antes de cambiarlo:
   *
   *     curl -I https://bipsy.es/__/auth/handler
   *
   * Tiene que contestar 200 o 302. Si da 404, el rewrite no está y cambiar
   * esto deja el acceso con Google roto: la ventana vuelve a una página que
   * no existe y no llega ningún token.
   *
   * Tener bipsy.es en «Authorized domains» de Firebase NO basta y no es lo
   * mismo: esa lista dice desde qué webs se puede ARRANCAR el acceso; este
   * valor dice dónde VUELVE Google, y es el que se enseña.
   */
  firebaseAuthDomain: 'gipsi-6806c.firebaseapp.com',
};
