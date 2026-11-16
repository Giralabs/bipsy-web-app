import { PageSeo } from '../page-meta.service';

/**
 * SEO of the routes that carry it in `data.seo`: the home and Buscar. It is
 * in the initial bundle with the routes, so only the text lives here; the
 * home's structured data is loaded apart (`home-json-ld.ts`).
 *
 * The other public pages set their own: Descargar (`download-seo.ts`), the
 * business page from the API (`business-seo.ts`) and each legal document.
 *
 * The descriptions say what is true today and use the words people search
 * with: «pedir cita», «barbería», «peluquería», «estética», «uñas»,
 * «cerca de ti».
 */

/** The home (Explorar). Its title is the one in `index.html`, and so is this description. */
export const HOME_SEO: PageSeo = {
  description:
    'Pide cita en barberías, peluquerías, centros de estética y de uñas cerca de ti. ' +
    'Mira servicios, precios y opiniones, elige día y hora y reserva sin llamar.',
  jsonLd: () => import('./home-json-ld').then(m => m.homeJsonLd()),
};

export const SEARCH_SEO: PageSeo = {
  fullTitle: 'Buscar barberías, peluquerías y estética cerca de ti · Bipsy',
  description:
    'Busca barberías, peluquerías, centros de estética, uñas y más negocios cerca de ti. ' +
    'Filtra por zona, día y hora o a domicilio, y pide cita online en Bipsy.',
};
