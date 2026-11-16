import { ComponentRef, Injectable, ViewContainerRef, signal } from '@angular/core';
import { GA_MEASUREMENT_ID } from '../data/site.data';

/** Where the visitor's answer to the cookie notice is kept: `granted` or `denied`. */
export const CONSENT_KEY = 'bipsy.cookies.analytics';

type Choice = 'granted' | 'denied';

/**
 * Google Analytics 4, only with consent (AEPD guide on cookies).
 *
 * Nothing from Google is requested before the visitor accepts: no gtag, no
 * Consent Mode pings. Accepting loads gtag; rejecting stores the «no» and
 * switches gtag off and deletes its cookies; and «Configurar cookies»
 * ([reopen]) asks again.
 *
 * With an empty [GA_MEASUREMENT_ID] it does nothing at all, and is not even
 * downloaded: the root and the footer import it on demand, only with an ID
 * (the initial bundle has no room to spare). The gtag code
 * (`analytics-gtag.ts`) and the notice (`CookieConsentComponent`) come in
 * their own chunks, when they are needed.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  /** There is an ID (and a browser), so there is something to accept. */
  readonly enabled = GA_MEASUREMENT_ID !== '' && typeof window !== 'undefined';

  /** The notice has to be shown: analytics is on and the visitor has not answered. */
  readonly needsChoice = signal(this.enabled && readChoice() === null);

  private host: ViewContainerRef | null = null;
  private notice: ComponentRef<unknown> | null = null;

  constructor() {
    if (this.enabled && readChoice() === 'granted') {
      this.load();
    }
  }

  /**
   * Where the notice goes: the root's container, so it lives next to the app
   * and not inside any page. The root calls this once.
   */
  mountNoticeIn(host: ViewContainerRef): void {
    this.host = host;
    void this.syncNotice();
  }

  accept(): void {
    this.answer('granted');
    this.load();
  }

  /**
   * Always cleans up, not only if gtag ran in this visit: whoever accepted in
   * an earlier visit and now says no still has the `_ga` cookies from then.
   */
  reject(): void {
    this.answer('denied');
    void import('./analytics-gtag').then(gtag => gtag.disable(GA_MEASUREMENT_ID));
  }

  /** Forgets the answer so the notice comes back. */
  reopen(): void {
    if (!this.enabled) return;
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch { /* No storage: there was nothing stored either. */ }
    this.setNeedsChoice(true);
  }

  private answer(choice: Choice): void {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch { /* No storage: it applies to this visit only. */ }
    this.setNeedsChoice(false);
  }

  private setNeedsChoice(value: boolean): void {
    this.needsChoice.set(value);
    void this.syncNotice();
  }

  /** Shows or removes the notice to match [needsChoice]. */
  private async syncNotice(): Promise<void> {
    if (!this.needsChoice()) {
      this.notice?.destroy();
      this.notice = null;
      return;
    }
    if (this.notice || !this.host) return;
    const { CookieConsentComponent } = await import('../components/cookie-consent/cookie-consent.component');
    // It may have been answered, or shown, while the chunk was on its way.
    if (this.notice || !this.host || !this.needsChoice()) return;
    this.notice = this.host.createComponent(CookieConsentComponent);
  }

  /** Idempotent: accepting again after a «no» in the same visit switches gtag back on. */
  private load(): void {
    if (!this.enabled) return;
    void import('./analytics-gtag').then(gtag => gtag.load(GA_MEASUREMENT_ID));
  }
}

/** The stored answer, or null without one (or without storage). */
function readChoice(): Choice | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}
