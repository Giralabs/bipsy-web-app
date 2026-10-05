import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HELP_INDEX, LEGAL_INDEX } from '../../pages/legal/legal.index';
import { LEGAL_COMPANY } from '../../pages/legal/legal.models';
import { HELP_CLIENTS_URL } from '../../data/site.data';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  readonly company = LEGAL_COMPANY;
  readonly year = new Date().getFullYear();

  /** Los documentos legales publicados. Solo el nombre, no el texto. */
  readonly legalDocs = LEGAL_INDEX;

  /** Contacto y seguridad, en su propia columna. */
  readonly helpDocs = HELP_INDEX;

  /** The help centre lives in its own app, so this one leaves the site. */
  readonly helpCentre = HELP_CLIENTS_URL;
}
