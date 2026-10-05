import { Component, inject } from '@angular/core';
import { MaintenanceService } from '../../core/maintenance.service';

/**
 * El recordatorio de que se está dentro con el pase del equipo.
 *
 * Quien entra durante un mantenimiento ve la web como siempre, y a los diez
 * minutos ya no se acuerda de que el público está viendo otra cosa. Esta
 * pastilla lo dice sin estorbar, y «Salir» olvida el pase para comprobar qué
 * ve de verdad quien llega de fuera.
 */
@Component({
  selector: 'app-maintenance-indicator',
  standalone: true,
  templateUrl: './maintenance-indicator.component.html',
  styleUrl: './maintenance-indicator.component.css',
})
export class MaintenanceIndicatorComponent {
  private readonly maintenance = inject(MaintenanceService);

  leave(): void {
    this.maintenance.leave();
  }
}
