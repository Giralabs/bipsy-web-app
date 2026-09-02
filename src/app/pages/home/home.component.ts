import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BipsyService } from '../../services/bipsy.service';
import { ApiError } from '../../core/api-error';
import { BusinessResponse, CategoryResponse } from '../../models/bipsy.models';
import { categoryIcon } from '../../shared/category-icons';
import { businessBookingPath, businessPath } from '../../shared/slug';
import { DragScrollDirective } from '../../shared/drag-scroll.directive';
import { BusinessCardComponent } from '../../components/business-card/business-card.component';
import { BusinessRowComponent } from '../../components/business-row/business-row.component';
import { SessionService } from '../../core/session.service';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ButtonComponent } from '../../components/button/button.component';
import { ChipComponent } from '../../components/chip/chip.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [AvatarComponent, CommonModule, RouterLink, FormsModule, BusinessCardComponent, BusinessRowComponent, ButtonComponent, ChipComponent, DragScrollDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  selectedCategoryCode: string = 'ALL';
  selectedCategoryId?: number;
  searchQuery: string = '';

  categories: CategoryResponse[] = [];
  businesses: BusinessResponse[] = [];
  featuredBusinesses: BusinessResponse[] = [];

  favoriteBusinesses: BusinessResponse[] = [];
  isAuthenticated = false;
  isLoading: boolean = true;
  loadError: ApiError | null = null;

  /** Cuántos esqueletos pintar mientras carga. Seis llenan la fila. */
  readonly skeletons = [1, 2, 3, 4, 5, 6];

  constructor(
    private bipsyService: BipsyService,
    private session: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Las filas personales dependen de la sesión, y la sesión tarda un
    // instante en resolverse al arrancar: sin esperar a que se sepa, la
    // portada se pintaba siempre como si nadie hubiera entrado.
    this.session.status$.subscribe(status => {
      if (status === 'unknown') {
        return;
      }
      this.isAuthenticated = status === 'authenticated';
      void this.loadData();
    });
  }

  async loadData(): Promise<void> {
    this.isLoading = true;
    this.loadError = null;

    try {
      const [cats, featured, favorites, rebook] = await Promise.all([
        this.bipsyService.getCategories(),
        this.bipsyService.getFeaturedBusinesses(12),
        this.bipsyService.getFavoriteBusinesses(),
        this.bipsyService.getRebookableBusinesses(),
      ]);
      this.categories = [{ id: 0, code: 'ALL', name: 'Todo', active: true }, ...cats];
      this.featuredBusinesses = withRebookablesFirst(featured, rebook);
      this.businesses = featured;
      this.favoriteBusinesses = favorites;
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  async selectCategory(cat: CategoryResponse): Promise<void> {
    this.selectedCategoryCode = cat.code;
    this.selectedCategoryId = cat.id === 0 ? undefined : cat.id;
    if (cat.id === 0) {
      await this.loadData();
      return;
    }

    this.isLoading = true;
    this.loadError = null;
    try {
      const res = await this.bipsyService.searchBusinesses({ categoryId: cat.id });
      this.businesses = res;
    } catch (error) {
      this.loadError = ApiError.from(error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Volver a reservar lo mismo. No abre la ficha: entra directo al flujo con
   * el servicio de la última cita, que es el trabajo que este botón ahorra.
   * Sin ese dato no se puede repetir nada y se cae a la ficha.
   */
  onRebook(business: BusinessResponse): void {
    const serviceId = business.discovery?.lastServiceId;
    if (!serviceId) {
      this.router.navigate(businessPath(business));
      return;
    }
    this.router.navigate(businessBookingPath(business), {
      queryParams: { serviceId, workerId: business.discovery?.lastWorkerId },
    });
  }

  /**
   * El saludo de la cabecera de Explorar.
   *
   * Sin sesión, «Bienvenido»: un «Hola» a secas suena a que deberíamos saber
   * quién eres y no lo sabemos. Es literal de la app.
   */
  get greeting(): string {
    const name = this.session.currentUser?.name?.trim().split(/\s+/)[0];
    return name ? `Hola, ${name}` : 'Bienvenido';
  }

  get avatarPhoto(): string | null {
    return this.session.currentUser?.profileImageUrl ?? null;
  }

  get avatarName(): string | null {
    return this.session.currentUser?.name ?? null;
  }

  /** Con sesión, a los ajustes; sin ella, a entrar. Igual que en la app. */
  get avatarLink(): string {
    return this.session.currentUser ? '/profile' : '/acceder';
  }

  executeSearch(): void {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  getSelectedCategoryName(): string {
    const cat = this.categories.find(c => c.code === this.selectedCategoryCode);
    return cat?.name || 'Resultados';
  }

  getCategoryIcon(code: string): string {
    return categoryIcon(code);
  }

  clientEmail: string = '';

  onDownloadClick(): void {
    if (this.clientEmail.trim()) {
      alert(`¡Enlace de descarga enviado a ${this.clientEmail.trim()}! Redirigiendo a la descarga...`);
      window.open('https://www.youtube.com', '_blank');
    } else {
      alert('Por favor, introduce tu correo electrónico.');
    }
  }
}

/**
 * Los sitios donde ya has reservado, delante de los destacados.
 *
 * No son una fila aparte: "volver a reservar" no es una categoría, es una
 * acción sobre un negocio que ya conoces. Puesto como fila propia repetía los
 * mismos negocios dos veces y partía la portada en trozos que dicen lo mismo.
 * Aquí van primeros y con su icono, que es lo que los distingue.
 *
 * Se marcan con `discovery.previouslyBooked` para que la tarjeta saque el
 * reloj y el botón redondo sin que la fila tenga que saber de dónde salieron.
 */
function withRebookablesFirst(
  featured: BusinessResponse[],
  rebookable: BusinessResponse[],
): BusinessResponse[] {
  if (rebookable.length === 0) {
    return featured;
  }
  const first = rebookable.map(business => ({
    ...business,
    discovery: { featured: false, recentlyOpened: false, ...business.discovery, previouslyBooked: true },
  }));
  const seen = new Set(first.map(b => b.id));
  return [...first, ...featured.filter(b => !seen.has(b.id))];
}
