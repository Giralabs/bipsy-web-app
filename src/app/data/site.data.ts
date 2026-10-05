/**
 * Site-wide addresses that point outside this app.
 */

/**
 * The help centre, which is its own site (bipsy-help-app, in Astro) on its
 * own subdomain, shared with bipsy-business-web-app so the answers live in
 * one place. `/clientes` is the half written for the people who book.
 *
 * Browsing locally it points at the Astro dev server instead, so following
 * the link while developing does not throw you out to production. Any host
 * that is not localhost is treated as the real thing — including a
 * production build served locally, which is what you want when checking one.
 */
const HELP_PROD_URL = 'https://help.bipsy.es';
/** Where `npm start` in bipsy-help-app serves it (see its astro.config.mjs). */
const HELP_DEV_URL = 'http://localhost:4321';

const onLocalhost = typeof location !== 'undefined'
  && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

export const HELP_URL = onLocalhost ? HELP_DEV_URL : HELP_PROD_URL;
export const HELP_CLIENTS_URL = `${HELP_URL}/clientes`;
