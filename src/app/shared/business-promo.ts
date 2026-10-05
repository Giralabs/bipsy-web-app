import { Router } from '@angular/router';

/**
 * Lleva a la tarjeta de Bipsy Business de la portada.
 *
 * No hay una ruta de alta de negocio en esta web —el alta se hace desde la app
 * Bipsy Business—, así que todos los reclamos («¿Tienes un negocio?» del
 * header, la tira promocional) apuntan al mismo sitio: la tarjeta de la
 * portada, que es donde están los enlaces a las tiendas.
 *
 * La espera es porque la portada se carga en diferido: al resolver `navigate`
 * la plantilla todavía no ha pintado y `querySelector` devolvería null.
 */
export function scrollToBusinessPromo(router: Router): void {
  router.navigate(['/']).then(() => {
    setTimeout(() => {
      document.querySelector('.business-promo-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
  });
}
