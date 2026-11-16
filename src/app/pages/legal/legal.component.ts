import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { PageMetaService } from '../../core/page-meta.service';
import { AnalyticsService } from '../../core/analytics.service';
import { ButtonComponent } from '../../components/button/button.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LEGAL_DOCUMENTS } from './legal.content';
import { LegalDocument, LEGAL_COMPANY_INCOMPLETE } from './legal.models';
import { LEGAL_GROUPS, LEGAL_INDEX, HELP_INDEX } from './legal.index';

/**
 * Página de un documento legal o de ayuda. Seis en total, todas sin sesión.
 *
 * Un solo componente los sirve todos: comparten estructura y estilo,
 * y lo único que cambia es el contenido, que vive en legal.content.ts. El
 * documento se elige por el parámetro :slug de la ruta.
 *
 * La app móvil enlaza aquí desde la casilla de aceptación del registro, así que
 * la página tiene que poder abrirse sin sesión.
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonComponent],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.css'
})
export class LegalComponent implements OnInit, OnDestroy {
  doc: LegalDocument | null = null;

  private readonly meta = inject(PageMetaService);
  /** The cookie policy offers «Configurar cookies» when there is analytics. */
  readonly analytics = inject(AnalyticsService);
  private releaseMeta: (() => void) | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // paramMap y no snapshot: navegar de términos a privacidad reutiliza el
    // componente y con snapshot se quedaría el documento anterior.
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? 'terminos';
      this.doc = LEGAL_DOCUMENTS[slug] ?? null;
      // Each document is its own indexable page; an unknown slug renders the
      // «not found» block and must not be indexed.
      this.releaseMeta = this.doc
        ? this.meta.apply({
            title: this.doc.title,
            description: `${this.doc.subtitle}.`,
            path: `/legal/${this.doc.slug}`,
          })
        : this.meta.set('Página no encontrada', true);
      // Solo al principio si NO se venía a un apartado concreto: con un
      // fragmento en la URL, el router ya está saltando allí y subir a la vez
      // deja al usuario arriba en vez de donde pidió ir.
      if (!this.route.snapshot.fragment) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
  }

  ngOnDestroy(): void {
    this.releaseMeta?.();
  }

  /** Los dos grupos de la barra lateral: lo legal y lo de ayuda. */
  readonly groups = LEGAL_GROUPS;

  /** Todas las páginas de la sección, en el orden en que se enseñan. */
  private readonly allPages = [...LEGAL_INDEX, ...HELP_INDEX];

  /**
   * Los demás documentos, para los enlaces cruzados del pie.
   *
   * Sale del índice y no de una lista escrita aquí: son cuatro documentos que
   * se remiten unos a otros, y basta con publicar el quinto para que aparezca
   * en los cuatro pies sin tocar nada.
   */
  get otherDocs(): { slug: string; title: string }[] {
    return this.allPages.filter(entry => entry.slug !== this.doc?.slug);
  }

  /** Marca el documento como borrador mientras no lo revise un abogado. */
  get isDraft(): boolean {
    return this.doc?.version.includes('borrador') ?? false;
  }

  /** Faltan datos identificativos obligatorios del prestador (LSSI-CE). */
  get companyIncomplete(): boolean {
    return LEGAL_COMPANY_INCOMPLETE;
  }
}
