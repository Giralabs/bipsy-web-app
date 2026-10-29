import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageMetaService } from '../../core/page-meta.service';
import {
  BipsyApp,
  STORE_LINKS_READY,
  appStoreUrl,
  mobilePlatformOf,
  playStoreUrl,
  storeUrlFor,
} from '../../data/app-links';
import { ButtonComponent } from '../../components/button/button.component';
import { StatusPageComponent } from '../../components/status-page/status-page.component';

/**
 * `/descargar` y `/descargar/negocio`: manda a la tienda que toque.
 *
 * Existe para que los mensajes que se comparten desde las apps lleven UNA
 * dirección que no cambia: la ficha de la App Store abierta en Android no lleva
 * a ninguna parte, y el día que se publiquen se toca `data/app-links.ts` y no
 * cada mensaje ya enviado.
 *
 * En el móvil, con la ficha ya publicada, redirige sin enseñar nada. En el
 * ordenador, o sin fichas todavía, enseña las dos tiendas o el «muy pronto».
 */
@Component({
  selector: 'app-download',
  standalone: true,
  imports: [StatusPageComponent, ButtonComponent],
  templateUrl: './download.component.html',
})
export class DownloadComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly releaseMeta = inject(PageMetaService).set('Descargar Bipsy');

  readonly app: BipsyApp = this.route.snapshot.data['app'] === 'business' ? 'business' : 'customer';
  readonly published = STORE_LINKS_READY;
  readonly appStore = appStoreUrl(this.app);
  readonly googlePlay = playStoreUrl(this.app);

  get heading(): string {
    return this.app === 'business' ? 'Bipsy para negocios' : 'Descarga Bipsy';
  }

  ngOnInit(): void {
    const destino = storeUrlFor(
      this.app,
      mobilePlatformOf(navigator.userAgent, 'ontouchend' in document),
    );
    // `replace` y no `href`: volver atrás desde la tienda no debe traer aquí
    // para mandar otra vez a la tienda.
    if (destino) window.location.replace(destino);
  }

  ngOnDestroy(): void {
    this.releaseMeta();
  }
}
