import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { SessionService } from '../../core/session.service';
import { CatalogRepository } from '../../repositories/catalog.repository';
import { BusinessResponse } from '../../models/bipsy.models';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { ButtonComponent } from '../../components/button/button.component';

/**
 * Tus favoritos. En la app son una fila dentro de Explorar; aquí, con sitio de
 * sobra, es su propia pantalla.
 *
 * Los ids viven en el perfil (`/customers/me`) y no hay endpoint que devuelva
 * los negocios enteros, así que se piden uno a uno. Con `allSettled`: un
 * negocio dado de baja no puede dejar la lista en blanco.
 */
@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, BusinessCardComponent, ButtonComponent],
  templateUrl: './favorites.component.html',
  styleUrl: './favorites.component.css',
})
export class FavoritesComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly catalog = inject(CatalogRepository);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSeq = 0;

  businesses: BusinessResponse[] = [];
  /** Destacados, para que una lista vacía proponga por dónde empezar. */
  suggestions: BusinessResponse[] = [];
  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  ngOnInit(): void {
    this.catalog.featured(0, 8)
      .then(list => (this.suggestions = list))
      .catch(() => (this.suggestions = []));

    // La sesión es un servicio raíz que no completa nunca: sin cortar, cada
    // visita a Favoritos dejaba viva su suscripción, y cada cambio de
    // favoritos relanzaba las cargas de todas las pantallas ya cerradas.
    this.session.status$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (!this.isAuthenticated) {
        this.isLoading = false;
        this.businesses = [];
      }
    });

    this.session.favoriteBusinessIds$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(ids => {
      void this.load(ids);
    });
  }

  async load(ids: number[]): Promise<void> {
    // Quitar dos favoritos seguidos lanza dos cargas; solo vale la última.
    const seq = ++this.loadSeq;
    if (ids.length === 0) {
      this.businesses = [];
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.loadError = null;
    try {
      const results = await Promise.allSettled(ids.map(id => this.catalog.business(id)));
      if (seq !== this.loadSeq) return;
      this.businesses = results
        .filter((r): r is PromiseFulfilledResult<BusinessResponse> => r.status === 'fulfilled')
        .map(r => r.value);
    } catch (error) {
      if (seq === this.loadSeq) this.loadError = ApiError.from(error);
    } finally {
      if (seq === this.loadSeq) this.isLoading = false;
    }
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/favoritos' } });
  }

  goExplore(): void {
    this.router.navigate(['/buscar']);
  }
}
