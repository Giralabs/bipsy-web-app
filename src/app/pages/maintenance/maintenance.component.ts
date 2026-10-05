import { Component, OnDestroy, inject } from '@angular/core';
import { MaintenanceService } from '../../core/maintenance.service';
import { PageMetaService } from '../../core/page-meta.service';
import { ButtonComponent } from '../../components/button/button.component';
import { StatusPageComponent } from '../../components/status-page/status-page.component';

/**
 * La web está en mantenimiento.
 *
 * No es una ruta: la pinta la raíz EN VEZ de la web entera, en cualquier
 * dirección, y por eso no lleva barra, pie ni un solo enlace hacia dentro —no
 * hay dentro al que ir—. Se quita sola en cuanto `MaintenanceService` recibe
 * que el mantenimiento ha terminado; el botón solo adelanta esa pregunta.
 */
@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [StatusPageComponent, ButtonComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.css',
})
export class MaintenanceComponent implements OnDestroy {
  readonly maintenance = inject(MaintenanceService);

  private readonly releaseMeta = inject(PageMetaService).set('Volvemos enseguida', true);

  retrying = false;

  /** Se ha vuelto a preguntar y sigue cerrado: hay que decirlo, o el botón parece roto. */
  stillClosed = false;

  async retry(): Promise<void> {
    if (this.retrying) {
      return;
    }
    this.retrying = true;
    this.stillClosed = false;
    await this.maintenance.check();
    this.retrying = false;
    // Si ya está abierta, esta pantalla se destruye y esto no llega a verse.
    this.stillClosed = this.maintenance.blocked();
  }

  ngOnDestroy(): void {
    this.releaseMeta();
  }
}
