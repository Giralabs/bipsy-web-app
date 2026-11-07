// Ubicación aproximada por la IP, para ordenar Bipsy sin pedir permiso.
//
// Vercel pone en cada petición la ciudad y el punto aproximados de la IP que
// la hace (`x-vercel-ip-*`), gratis y sin servicios de terceros. Esto solo los
// devuelve en JSON a la propia web (`LocationService.loadApprox`). Es la ciudad,
// no la calle: la web la presenta como «Cerca de Madrid», nunca como la
// ubicación exacta.
//
// Solo existe en Vercel (producción, previews o `vercel dev`). Con `ng serve`
// u otro hosting no hay nada en /api/geo y la web sigue sin ubicación.
//
// `private, no-store`: la respuesta es de quien pregunta. Una caché compartida
// le daría a todo el mundo la ciudad del primero que pasó.

export const config = { runtime: 'edge' };

/** Vercel manda la ciudad codificada como en una URL («M%C3%A1laga»). */
function decode(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function number(value) {
  const n = Number(value);
  return value != null && value !== '' && Number.isFinite(n) ? n : null;
}

export default function handler(request) {
  const h = request.headers;
  const lat = number(h.get('x-vercel-ip-latitude'));
  const lng = number(h.get('x-vercel-ip-longitude'));
  const body =
    lat === null || lng === null
      ? { lat: null, lng: null, city: null, country: null }
      : {
          lat,
          lng,
          city: decode(h.get('x-vercel-ip-city')),
          country: h.get('x-vercel-ip-country') || null,
        };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store',
    },
  });
}
