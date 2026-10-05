import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { BIP_RIG_BASE, BIP_RIG_COUNT, BIP_RIG_FALLBACK, BIP_RIG_LAYERS } from './bip-rig.data';

/**
 * El Bip de soporte —el del escritorio—, animado por piezas: ladea la cabeza,
 * parpadea, teclea, mueve el pulgar y se mece la planta. La figura entera NO
 * sube ni baja: está sentado.
 *
 * Es el mismo dibujo que `assets_bip/bip_support.webp`, cortado en capas por
 * `scripts/build-bip-rig.mjs`; apiladas en reposo devuelven el original. Todo
 * el movimiento es CSS (`transform` sobre cada capa), sin librerías.
 *
 * Decorativo: va con `aria-hidden`. Ocupa la caja que le dé quien lo usa
 * (cuadrada); con `prefers-reduced-motion` se queda quieto.
 *
 * Hasta que no han llegado todas las capas no se enseña nada —un cuerpo sin
 * cabeza es peor que medio segundo de hueco—, y si alguna falla se pinta el
 * dibujo entero, sin animar.
 */
@Component({
  selector: 'app-bip-rig',
  standalone: true,
  templateUrl: './bip-rig.component.html',
  styleUrl: './bip-rig.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class BipRigComponent {
  readonly layers = BIP_RIG_LAYERS;
  readonly fallback = BIP_RIG_FALLBACK;

  private readonly loaded = signal(0);
  readonly failed = signal(false);
  readonly ready = computed(() => this.loaded() >= BIP_RIG_COUNT);

  src(key: string): string {
    return `${BIP_RIG_BASE}${key}.webp`;
  }

  onLoad(): void {
    this.loaded.update(n => n + 1);
  }

  onError(): void {
    this.failed.set(true);
  }
}
