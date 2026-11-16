import { SITE_URL } from '../page-meta.service';
import {
  APP_STORE_READY,
  BipsyApp,
  PLAY_STORE_READY,
  appStoreUrl,
  playStoreUrl,
} from '../../data/app-links';
import { GIRALABS_URL, INSTAGRAM_URL } from '../../data/site.data';

/**
 * The home's structured data: who Bipsy is (`Organization`), the site with
 * its search (`WebSite`) and the customer app (`MobileApplication`). One
 * block per entity, linked by `@id`.
 *
 * Loaded on demand by `HOME_SEO` (site-seo.ts): it is only for crawlers and
 * has no business in the initial bundle.
 *
 * The stores follow the switches in `app-links.ts`: the day Android is
 * published, Google Play is added here without touching this file.
 */

/** The square brand mark, for the Organization logo (Google wants 112 px or more). */
const LOGO_URL = `${SITE_URL}/assets_bipsy/Resized/512px/Brand%20Marks/mint_symbol.webp`;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** The stores where an app is already published. */
function storeUrls(app: BipsyApp): string[] {
  return [
    ...(APP_STORE_READY ? [appStoreUrl(app)] : []),
    ...(PLAY_STORE_READY ? [playStoreUrl(app)] : []),
  ];
}

export function homeJsonLd(): object[] {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Bipsy',
    url: `${SITE_URL}/`,
    logo: LOGO_URL,
    sameAs: [INSTAGRAM_URL, ...storeUrls('customer'), ...storeUrls('business')],
  };

  // Buscar reads the term from `?q=` (search.component.ts), so a search
  // started from Google lands on its results.
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Bipsy',
    url: `${SITE_URL}/`,
    inLanguage: 'es-ES',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const blocks: object[] = [organization, website];

  const downloads = storeUrls('customer');
  if (downloads.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'Bipsy',
      operatingSystem: [APP_STORE_READY && 'iOS', PLAY_STORE_READY && 'Android'].filter(Boolean).join(', '),
      applicationCategory: 'LifestyleApplication',
      inLanguage: 'es',
      downloadUrl: downloads.length === 1 ? downloads[0] : downloads,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@type': 'Organization', name: 'Giralabs', url: GIRALABS_URL },
    });
  }
  return blocks;
}
