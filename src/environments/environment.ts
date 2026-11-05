/**
 * Configuración de producción.
 *
 * Mismo criterio que el `core/env.dart` de cada app: la URL por defecto es la
 * de producción, y el desarrollo la sustituye (ver `fileReplacements` en
 * angular.json).
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.bipsy.es',

  /**
   * El dominio del acceso con Google. Es lo que se lee en «Ir a …» cuando
   * Google pide elegir cuenta.
   *
   * Es `bipsy.es` porque el dominio sirve desde Vercel con el `vercel.json`
   * de este repo, que reescribe `/__/auth/*` hacia Firebase: así bipsy.es
   * sabe responder al retorno de Google y de Apple, y la ventana enseña
   * bipsy.es en vez de `gipsi-6806c.firebaseapp.com`. Comprobado el 3/11/2026:
   *
   *     curl -I https://bipsy.es/__/auth/handler   → 200
   *
   * Si algún día da 404, el rewrite se ha caído y el acceso con Google y Apple
   * se rompe: la ventana vuelve a una página que no existe y no llega ningún
   * token. Y `https://bipsy.es/__/auth/handler` tiene que estar en las
   * «Return URLs» del Services ID de Apple y en las URIs de redirección del
   * cliente OAuth web de Google; si falta, Apple da `invalid_request` y Google
   * `redirect_uri_mismatch`.
   *
   * En desarrollo sigue siendo el de Firebase: `ng serve` no tiene ese
   * rewrite, y Apple no admite `localhost` como dirección de vuelta.
   *
   * Tener bipsy.es en «Authorized domains» de Firebase NO basta y no es lo
   * mismo: esa lista dice desde qué webs se puede ARRANCAR el acceso; este
   * valor dice dónde VUELVE Google, y es el que se enseña.
   */
  firebaseAuthDomain: 'bipsy.es',
};
