import { Component, OnInit, inject } from '@angular/core';
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

  businesses: BusinessResponse[] = [];
  isAuthenticated = false;
  isLoading = true;
  loadError: ApiError | null = null;

  ngOnInit(): void {
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      if (!this.isAuthenticated) {
        this.isLoading = false;
        this.businesses = [];
      }
    });

    this.session.favoriteBusinessIds$.subscribe(ids => {
      void this.load(ids);
    });
  }

  async load(ids: number[]): Promise<void> {
    if (ids.length === 0) {
      this.businesses = [];
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.loadError = null;
    try {
      const results = await Promise.allSettled(ids.map(id => this.catalog.business(id)));
      this.businesses = results
        .filter((r): r is PromiseFulfilledResult<BusinessResponse> => r.status === 'fulfilled')
        .map(r => r.value);
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin(): void {
    this.router.navigate(['/acceder'], { queryParams: { returnTo: '/favoritos' } });
  }

  goExplore(): void {
    this.router.navigate(['/home']);
  }
}
