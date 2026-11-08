import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HELP_INDEX, LEGAL_INDEX } from '../../pages/legal/legal.index';
import { LEGAL_COMPANY } from '../../pages/legal/legal.models';
import { HELP_CLIENTS_URL } from '../../data/site.data';
import { APP_STORE_URL, PLAY_STORE_URL, STORE_LINKS_READY } from '../../data/app-links';
import { ComingSoonDirective, SOON } from '../../shared/coming-soon.directive';

/** El perfil de Bipsy en Instagram. */
const INSTAGRAM_URL = 'https://www.instagram.com/bipsy_es/';

/** Iconos de las redes, en una caja de 24×24 pintada con currentColor. */
const SOCIAL_ICONS = {
  instagram:
    'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 4.6a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4Zm0 8.6a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8Zm5.4-9.9a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z',
  tiktok:
    'M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9a6.3 6.3 0 1 0 5.3 6.2V8.6a7.9 7.9 0 0 0 4.4 1.4V6.7a4.5 4.5 0 0 1-4.4-4.7Z',
} as const;

/**
 * Pie de la web.
 *
 * Aquí va lo que la LSSI-CE obliga a tener accesible desde cualquier página:
 * quién presta el servicio, cómo contactar y los documentos legales. Enlazarlo
 * solo desde el registro —que es donde estaba— deja fuera a quien entra a
 * mirar y no se da de alta, que son la mayoría.
 *
 * **Bipsy es el nombre comercial; Giralabs es quien lo desarrolla y presta el
 * servicio.** Las dos marcas se enseñan porque son cosas distintas y la ley
 * pide identificar a la segunda.
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, ComingSoonDirective],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  readonly company = LEGAL_COMPANY;
  readonly year = new Date().getFullYear();

  // Los badges de las tiendas. Apuntaban a youtube.com, de la plantilla de la
  // que salió este pie: un enlace que se ve bien y lleva a otro sitio. Hasta
  // que las fichas se publiquen dicen «Próximamente» al pulsarlos.
  readonly appStoreUrl = APP_STORE_URL;
  readonly playStoreUrl = PLAY_STORE_URL;
  readonly storeLinksReady = STORE_LINKS_READY;
  readonly soon = SOON;
  readonly icons = SOCIAL_ICONS;
  readonly instagramUrl = INSTAGRAM_URL;

  /** Los documentos legales publicados. Solo el nombre, no el texto. */
  readonly legalDocs = LEGAL_INDEX;

  /** Contacto y seguridad, en su propia columna. */
  readonly helpDocs = HELP_INDEX;

  /** The help centre lives in its own app, so this one leaves the site. */
  readonly helpCentre = HELP_CLIENTS_URL;
}
