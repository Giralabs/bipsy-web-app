/**
 * Subdominios de negocio: ismaelillobarber.bipsy.es → bipsy.es/negocio/ismaelillo-barber-19
 *
 * Cada negocio tiene un subdominio (bipsy-backend V131) que no sirve ninguna
 * página: es una dirección corta para la bio de Instagram, una historia o un
 * cartel. Este Worker, en la ruta `*.bipsy.es/*` de Cloudflare, pregunta al
 * backend a qué ficha lleva y redirige.
 *
 *  - `<sub>.bipsy.es` y cualquier ruta    → la ficha
 *  - `<sub>.bipsy.es/reservar`            → la reserva de ese negocio
 *  - La consulta (`?utm_source=ig`) se conserva.
 *  - Un subdominio que no es de nadie     → la búsqueda de bipsy.es con ese texto.
 *
 * Los subdominios de la plataforma (business, api, help…) tienen su propio
 * registro DNS. Si alguno pasa por el proxy de Cloudflare también entra aquí,
 * y se deja pasar tal cual a su origen.
 *
 * 302 y no 301: si el negocio cambia de nombre la ruta de su ficha cambia, y
 * un 301 se queda guardado en el navegador para siempre.
 */

const ROOT = 'bipsy.es';
const WEB = `https://${ROOT}`;
const DEFAULT_API = 'https://api.bipsy.es';

/** Subdominios de la plataforma: nunca son negocios (BusinessSubdomainService.RESERVED). */
const PLATFORM = new Set(['www', 'api', 'business', 'help', 'admin', 'app', 'mail', 'status', 'cdn']);

/** Cuánto se recuerda en el borde a qué ficha lleva un subdominio. */
const CACHE_SECONDS = 300;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Solo *.bipsy.es de un nivel. Lo demás no es cosa de este Worker.
    if (!host.endsWith(`.${ROOT}`)) return fetch(request);
    const sub = host.slice(0, -(ROOT.length + 1));
    if (!sub || sub.includes('.')) return fetch(request);

    if (sub === 'www') return redirect(`${WEB}${url.pathname}${url.search}`, 301);
    if (PLATFORM.has(sub)) return fetch(request);

    const api = (env && env.API_URL) || DEFAULT_API;
    let target = null;
    try {
      const res = await fetch(`${api}/businesses/subdomain/${encodeURIComponent(sub)}`, {
        headers: { Accept: 'application/json' },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });
      if (res.ok) {
        const body = await res.json();
        if (body && typeof body.webPath === 'string' && body.webPath.startsWith('/negocio/')) {
          target = body.webPath;
        }
      }
    } catch {
      // Backend caído o lento: mejor la búsqueda que una página de error.
    }

    if (!target) {
      return redirect(`${WEB}/buscar?q=${encodeURIComponent(sub)}`, 302);
    }
    const booking = /^\/reservar\/?$/i.test(url.pathname) ? '/reservar' : '';
    return redirect(`${WEB}${target}${booking}${url.search}`, 302);
  },
};

function redirect(location, status) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      // Que ni el navegador ni un proxy guarden la redirección más de lo que
      // la guarda el propio Worker.
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}
