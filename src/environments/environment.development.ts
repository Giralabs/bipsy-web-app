/** Configuración de desarrollo. La usa `ng serve` y `npm run watch`. */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',

  /**
   * En desarrollo, SIEMPRE el de Firebase.
   *
   * `localhost` no puede servir `/__/auth/handler` —no hay rewrite de Vercel
   * delante—, así que aquí un dominio propio rompería el acceso con Google en
   * la máquina de quien desarrolla. Este valor no se toca.
   */
  firebaseAuthDomain: 'gipsi-6806c.firebaseapp.com',
};
