import { Component, OnDestroy, inject } from '@angular/core';
import { PageMetaService } from '../../core/page-meta.service';
import { ButtonComponent } from '../../components/button/button.component';
import { StatusPageComponent } from '../../components/status-page/status-page.component';

/**
 * Página no encontrada.
 *
 * Antes el comodín redirigía a la portada: un enlace roto parecía funcionar y
 * dejaba a la gente en Explorar sin saber por qué no veía lo que había pedido.
 * Ahora se dice, dentro de la web de siempre —barra, pie, pestañas— y con dos
 * salidas.
 *
 * La usa también `/admin` cuando no hay mantenimiento, tal cual: esa dirección
 * no debe distinguirse de cualquier otra que no exista.
 *
 * `noindex` porque la respuesta HTTP es un 200 —Vercel sirve `index.html` para
 * todo— y sin él un buscador puede acabar indexando direcciones inventadas.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [StatusPageComponent, ButtonComponent],
  templateUrl: './not-found.component.html',
})
export class NotFoundComponent implements OnDestroy {
  private readonly releaseMeta = inject(PageMetaService).set('Página no encontrada', true);

  ngOnDestroy(): void {
    this.releaseMeta();
  }
}
