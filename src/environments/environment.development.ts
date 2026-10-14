/** Configuración de desarrollo. La usa `ng serve` y `npm run watch`. */
export const environment = {
  production: false,

  /**
   * El backend, **en la misma máquina que sirve la web**.
   *
   * No `localhost` a pelo: así la web también sirve desde el móvil. Abriéndola
   * por la IP de la red —`http://192.168.1.28:4200`, que es la única forma de
   * probar la reserva en un teléfono de verdad— `localhost` es el teléfono, y
   * ahí no hay ningún backend: la web se queda en modo mantenimiento y parece
   * que el servidor está caído. Con el host de la propia página, abierta en el
   * Mac va a `localhost` y abierta en el móvil va al Mac, sin tocar nada.
   *
   * Es el mismo criterio que los `dev-lan.json` de las apps, con la diferencia
   * de que aquí no hay IP escrita que quede obsoleta cuando el router reparta
   * otra — y la reparte: `.17` duró dos días.
   */
  apiUrl: `http://${globalThis.location?.hostname ?? 'localhost'}:8080`,

  /**
   * En desarrollo, SIEMPRE el de Firebase.
   *
   * `localhost` no puede servir `/__/auth/handler` —no hay rewrite de Vercel
   * delante—, así que aquí un dominio propio rompería el acceso con Google en
   * la máquina de quien desarrolla. Este valor no se toca.
   *
   * ⚠️ Y por eso **entrar con Google o con Apple no funciona abriendo la web
   * por la IP**: Firebase solo arranca el acceso desde un dominio de su lista
   * de autorizados, donde `localhost` está y una IP no puede estar. En el móvil
   * se prueba con correo y contraseña; los proveedores, en el Mac.
   */
  firebaseAuthDomain: 'gipsi-6806c.firebaseapp.com',
};
