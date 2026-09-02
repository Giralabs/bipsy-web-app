import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { scrollToBusinessPromo } from '../../shared/business-promo';

/**
 * Tira promocional sobre el header.
 *
 * Va en el flujo normal, por encima del `<app-navbar>`, que es `sticky`: al
 * bajar, la tira se va y la barra se queda pegada arriba. Así no hace falta
 * recalcular el hueco superior de ninguna página.
 *
 * Se puede cerrar y no vuelve: una tira que no se cierra es un banner, y al
 * tercer día molesta más de lo que convierte.
 */
@Component({
  selector: 'app-promo-bar',
  standalone: true,
  templateUrl: './promo-bar.component.html',
  styleUrl: './promo-bar.component.css',
})
export class PromoBarComponent {
  /** Documentado en la política de cookies como preferencia de interfaz. */
  private static readonly STORAGE_KEY = 'bipsy_promo_business';

  /**
   * La duración que se anuncia.
   *
   * ⚠️ Hoy NO coincide con lo que da el backend: el plan «Bipsy Business»
   * tiene `plan.trial_days = 14` y el alta regala `WELCOME_TRIAL_DAYS = 5`.
   * Antes de encender el cobro hay que cuadrar las dos cosas —subir
   * `trial_days` o bajar este texto— y crear la oferta de introducción en Play
   * Console y App Store Connect, o se estará anunciando algo que no se cumple.
   */
  readonly trialLabel = '3 meses gratis';

  dismissed = this.readDismissed();

  constructor(private router: Router) {}

  goToBusiness(): void {
    scrollToBusinessPromo(this.router);
  }

  dismiss(): void {
    this.dismissed = true;
    try {
      localStorage.setItem(PromoBarComponent.STORAGE_KEY, 'hidden');
    } catch {
      // Navegación privada o almacenamiento bloqueado: la tira se cierra en
      // esta sesión y reaparecerá en la siguiente. No es motivo para romper.
    }
  }

  private readDismissed(): boolean {
    try {
      return localStorage.getItem(PromoBarComponent.STORAGE_KEY) === 'hidden';
    } catch {
      return false;
    }
  }
}
