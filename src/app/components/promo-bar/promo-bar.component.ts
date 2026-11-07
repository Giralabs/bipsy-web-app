import { Component } from '@angular/core';
import { BUSINESS_URL } from '../../data/site.data';

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
   * La prueba que se anuncia, con las mismas palabras que la web de negocios
   * (`TRIAL_LABEL` en `bipsy-business-web-app`): si cambia allí, cambia aquí.
   *
   * Es lo que da el backend: el primer plan trae su primer mes gratis
   * (`plan.trial_months = 1`, un mes natural). Decía «30 días gratis», que no
   * es lo mismo que un mes natural y era publicidad que no se cumplía.
   */
  readonly trialLabel = 'Primer mes gratis';

  /**
   * Lleva a la web de Bipsy Business, donde el negocio ve qué incluye y se da
   * de alta. Antes bajaba al bloque de negocios de la portada, que no deja
   * hacer nada más que leer.
   */
  readonly businessUrl = BUSINESS_URL;

  dismissed = this.readDismissed();

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
