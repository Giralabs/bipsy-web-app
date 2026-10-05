import { Component, OnDestroy, computed, effect, inject, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError } from '../../core/api-error';
import { MaintenanceService } from '../../core/maintenance.service';
import { PageMetaService } from '../../core/page-meta.service';
import { ButtonComponent } from '../../components/button/button.component';
import { NotFoundComponent } from '../not-found/not-found.component';

/** Qué toca enseñar en `/admin`. */
type AdminView = 'form' | 'leaving' | 'not-found';

/**
 * `/admin`: la puerta del equipo durante un mantenimiento.
 *
 * **Sin mantenimiento, esta dirección no existe.** Pinta la página no
 * encontrada, la misma y con la misma web alrededor, y lo mismo mientras no se
 * sabe —el servidor aún no ha contestado, o ha fallado—. Una puerta que solo
 * aparece cuando hace falta no le dice a nadie que está ahí el resto del año.
 *
 * Con mantenimiento, pide la contraseña y la cambia por un pase; quien ya lo
 * tiene va directo a la portada. La raíz quita la barra y el pie en este caso
 * (ver `app.component.ts`): aquí solo se pinta el formulario.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, ButtonComponent, NotFoundComponent],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnDestroy {
  private readonly maintenance = inject(MaintenanceService);
  private readonly meta = inject(PageMetaService);
  private readonly router = inject(Router);

  readonly view = computed<AdminView>(() => {
    if (!this.maintenance.maintenance()) {
      return 'not-found';
    }
    return this.maintenance.bypass() ? 'leaving' : 'form';
  });

  password = '';
  showPassword = false;
  loading = false;
  error: string | null = null;

  private releaseMeta: (() => void) | null = null;

  constructor() {
    // El estado puede cambiar con esta pantalla abierta —llega la primera
    // respuesta del servidor, termina el mantenimiento, se entra desde otra
    // pestaña— y cada cambio trae su título y, si toca, su salida.
    effect(() => {
      const view = this.view();
      untracked(() => {
        this.releaseMeta?.();
        // En `not-found` el título lo pone la propia página no encontrada.
        this.releaseMeta = view === 'form' ? this.meta.set('Acceso del equipo', true) : null;
        if (view === 'leaving') {
          this.goHome();
        }
      });
    });
  }

  async submit(): Promise<void> {
    if (this.loading) {
      return;
    }
    if (!this.password) {
      this.error = 'Introduce la contraseña.';
      return;
    }

    this.loading = true;
    this.error = null;
    try {
      // Al entrar, `view` pasa a `leaving` y el efecto de arriba lleva a la
      // portada: no hay que navegar también desde aquí.
      await this.maintenance.unlock(this.password);
    } catch (raw) {
      const error = ApiError.from(raw);
      if (error.isNotFound) {
        // El mantenimiento se ha quitado mientras se escribía: no hay nada que
        // abrir. Se confirma con el servidor y se va a la web, ya abierta.
        await this.maintenance.check();
        this.goHome();
        return;
      }
      this.error = messageFor(error);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.releaseMeta?.();
  }

  /** `replaceUrl`: "atrás" desde la portada no debe devolver a esta puerta. */
  private goHome(): void {
    void this.router.navigateByUrl('/', { replaceUrl: true });
  }
}

/** El mensaje que ve el equipo. El del servidor manda solo en lo inesperado. */
function messageFor(error: ApiError): string {
  if (error.networkError) return 'Sin conexión con el servidor. Comprueba tu red e inténtalo de nuevo.';
  if (error.isUnauthorized) return 'Contraseña incorrecta.';
  if (error.isTooManyRequests) return 'Demasiados intentos. Espera un minuto y vuelve a probar.';
  return error.message || 'No hemos podido comprobar la contraseña. Inténtalo de nuevo.';
}
