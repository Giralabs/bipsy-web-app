// node cloudflare/subdomains/worker.test.mjs
// Prueba el Worker sin Cloudflare: fetch se sustituye por un backend falso.
import assert from 'node:assert/strict';
import worker from './worker.js';

const passed = [];
globalThis.fetch = async (input) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('https://api.bipsy.es/businesses/subdomain/')) {
    const sub = decodeURIComponent(url.split('/').pop());
    if (sub === 'ismaelillobarber') {
      return new Response(JSON.stringify({ id: 19, subdomain: 'ismaelillobarber', webPath: '/negocio/ismaelillo-barber-19' }), { status: 200 });
    }
    if (sub === 'roto') throw new Error('backend caído');
    return new Response('{}', { status: 404 });
  }
  passed.push(url);
  return new Response('origen', { status: 200 });
};

const go = (u) => worker.fetch(new Request(u), {});
const loc = (r) => r.headers.get('Location');

let r = await go('https://ismaelillobarber.bipsy.es/');
assert.equal(r.status, 302);
assert.equal(loc(r), 'https://bipsy.es/negocio/ismaelillo-barber-19');

r = await go('https://IsmaelilloBarber.bipsy.es/cualquier/cosa?utm_source=ig');
assert.equal(loc(r), 'https://bipsy.es/negocio/ismaelillo-barber-19?utm_source=ig');

r = await go('https://ismaelillobarber.bipsy.es/reservar');
assert.equal(loc(r), 'https://bipsy.es/negocio/ismaelillo-barber-19/reservar');

r = await go('https://nadie.bipsy.es/');
assert.equal(loc(r), 'https://bipsy.es/buscar?q=nadie');

r = await go('https://roto.bipsy.es/');
assert.equal(loc(r), 'https://bipsy.es/buscar?q=roto');

r = await go('https://www.bipsy.es/legal/terminos');
assert.equal(r.status, 301);
assert.equal(loc(r), 'https://bipsy.es/legal/terminos');

r = await go('https://business.bipsy.es/precios');
assert.equal(r.status, 200);
assert.equal(passed.at(-1), 'https://business.bipsy.es/precios');

r = await go('https://a.b.bipsy.es/');
assert.equal(r.status, 200);

console.log('worker: 8 casos OK');
