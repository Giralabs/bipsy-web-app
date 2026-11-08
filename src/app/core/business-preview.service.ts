import { Injectable, inject } from '@angular/core';
import { CatalogRepository } from '../repositories/catalog.repository';
import {
  BusinessPolicyGroup,
  BusinessResponse,
  PortfolioItem,
  ScheduleDayResponse,
  ServiceResponse,
} from '../models/bipsy.models';

/** Lo que la ficha pide además del negocio, ya en camino. */
export interface BusinessExtras {
  services: Promise<ServiceResponse[]>;
  policies: Promise<BusinessPolicyGroup[]>;
  portfolio: Promise<PortfolioItem[]>;
  schedule: Promise<ScheduleDayResponse[]>;
}

interface Prefetch {
  at: number;
  business: Promise<BusinessResponse>;
  extras: BusinessExtras;
}

/** Lo pedido por adelantado vale este rato: más, y la ficha podría salir vieja. */
const PREFETCH_TTL_MS = 30_000;

/**
 * Que abrir un negocio sea instantáneo.
 *
 * Antes, al pulsar una tarjeta la ficha arrancaba de cero: un esqueleto gris a
 * pantalla completa y, una décima después, todo de golpe. Dos cosas lo evitan:
 *
 * - **Lo que ya se ve.** Las tarjetas de la portada y de Buscar traen el
 *   negocio entero (nombre, portada, valoración, dirección). Se guarda al
 *   pintarlas y la ficha arranca desde ahí: la cabecera sale en el mismo
 *   fotograma del clic y lo demás se completa debajo.
 * - **Lo que se va a pedir.** Pasar el ratón por una tarjeta ya es intención:
 *   se piden la ficha, los servicios, el horario, las normas y la galería, y
 *   cuando llega el clic casi todo está en casa.
 */
@Injectable({ providedIn: 'root' })
export class BusinessPreviewService {
  private readonly catalog = inject(CatalogRepository);

  private readonly seen = new Map<number, BusinessResponse>();
  private readonly prefetched = new Map<number, Prefetch>();

  /** Lo que ya se ha pintado en una tarjeta. */
  remember(business: BusinessResponse | null | undefined): void {
    if (business?.id != null) this.seen.set(business.id, business);
  }

  rememberAll(list: readonly BusinessResponse[] | null | undefined): void {
    list?.forEach(b => this.remember(b));
  }

  /** Para pintar la cabecera de la ficha sin esperar a nadie. */
  peek(id: number): BusinessResponse | null {
    return this.seen.get(id) ?? null;
  }

  /** Empieza a pedir la ficha de [id]. Llamarlo varias veces no repite nada. */
  prefetch(id: number): void {
    const current = this.prefetched.get(id);
    if (current && Date.now() - current.at < PREFETCH_TTL_MS) return;
    const quiet = <T>(p: Promise<T>) => {
      // Si nadie llega a recogerla, que un fallo no salga como error suelto.
      p.catch(() => undefined);
      return p;
    };
    this.prefetched.set(id, {
      at: Date.now(),
      business: quiet(this.catalog.business(id)),
      extras: {
        services: quiet(this.catalog.businessServices(id)),
        policies: quiet(this.catalog.businessPolicies(id)),
        portfolio: quiet(this.catalog.businessPortfolio(id)),
        schedule: quiet(this.catalog.businessSchedule(id)),
      },
    });
  }

  /**
   * Lo pedido por adelantado, si está fresco. Se entrega una sola vez: la
   * siguiente visita a la ficha vuelve a preguntar.
   */
  take(id: number): Prefetch | null {
    const hit = this.prefetched.get(id);
    this.prefetched.delete(id);
    if (!hit || Date.now() - hit.at >= PREFETCH_TTL_MS) return null;
    return hit;
  }
}
