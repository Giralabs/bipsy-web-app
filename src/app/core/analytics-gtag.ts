/**
 * The gtag side of `AnalyticsService`, in its own chunk: it is only
 * downloaded once someone accepts analytics cookies (or rejects them, to
 * clean up).
 *
 * No `page_view` is sent by hand: GA4's enhanced measurement already counts
 * the SPA's navigations from the History API.
 */

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [disableFlag: `ga-disable-${string}`]: boolean | undefined;
};

const SCRIPT_ID = 'bipsy-gtag';

/** Loads gtag.js for [id] once, and lifts a previous opt-out of this visit. */
export function load(id: string): void {
  const w = window as unknown as GtagWindow;
  w[`ga-disable-${id}`] = false;
  if (document.getElementById(SCRIPT_ID)) return;

  w.dataLayer = w.dataLayer || [];
  // gtag must push the `arguments` object itself, not an array: it is what
  // gtag.js expects to find in the dataLayer.
  w.gtag = function gtag() {
    w.dataLayer!.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id);

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/**
 * Stops gtag for the rest of the visit (Google's documented opt-out flag)
 * and deletes its cookies: `_ga` and `_ga_<container>`, set on the
 * registrable domain (`.bipsy.es`) and possibly on the host itself.
 */
export function disable(id: string): void {
  (window as unknown as GtagWindow)[`ga-disable-${id}`] = true;

  const names = document.cookie
    .split(';')
    .map(cookie => cookie.split('=')[0].trim())
    .filter(name => name === '_ga' || name.startsWith('_ga_'));
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie =
        `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (domain ? `; domain=${domain}` : '');
    }
  }
}
