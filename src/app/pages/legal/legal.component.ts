import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LEGAL_DOCUMENTS } from './legal.content';
import { LegalDocument, LEGAL_COMPANY_INCOMPLETE } from './legal.models';

/**
 * Página de un documento legal (términos o privacidad).
 *
 * Un solo componente sirve los dos documentos: comparten estructura y estilo,
 * y lo único que cambia es el contenido, que vive en legal.content.ts. El
 * documento se elige por el parámetro :slug de la ruta.
 *
 * La app móvil enlaza aquí desde la casilla de aceptación del registro, así que
 * la página tiene que poder abrirse sin sesión.
 */
@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal.component.html',
  styleUrl: './legal.component.css'
})
export class LegalComponent implements OnInit {
  doc: LegalDocument | null = null;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // paramMap y no snapshot: navegar de términos a privacidad reutiliza el
    // componente y con snapshot se quedaría el documento anterior.
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') ?? 'terminos';
      this.doc = LEGAL_DOCUMENTS[slug] ?? null;
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  /** El otro documento, para el enlace cruzado del pie. */
  get otherSlug(): string {
    return this.doc?.slug === 'terminos' ? 'privacidad' : 'terminos';
  }

  get otherTitle(): string {
    return this.doc?.slug === 'terminos'
      ? 'Política de privacidad'
      : 'Términos y condiciones';
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
