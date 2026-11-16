import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../core/analytics.service';
import { ButtonComponent } from '../button/button.component';

/**
 * The analytics cookie notice. `AnalyticsService` imports it and mounts it
 * next to the root only while `needsChoice()`, so with no measurement ID it
 * is never even downloaded. (Not `@defer`: its runtime alone added 6 kB to
 * the initial bundle.)
 *
 * «Rechazar» and «Aceptar» are the same button, side by side: the AEPD wants
 * saying no to be exactly as easy and as visible as saying yes. No pre-ticked
 * choice, and nothing loads until «Aceptar».
 */
// Re-exported so the root and the footer reach the service through THIS
// module when they load it on demand. Importing analytics.service.ts on its
// own made it a separate entry point that only needs @angular/core, and
// esbuild split Angular's initial chunk in two to serve it: 1 kB more of
// glue in the initial bundle.
export { AnalyticsService };

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [RouterLink, ButtonComponent],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.css',
})
export class CookieConsentComponent {
  readonly analytics = inject(AnalyticsService);
}
