// Saca de los originales del kit de marca las imágenes que pinta la web, a la
// medida a la que se pintan. Hay que volver a lanzarlo si cambia un original.
//
//   npm i --no-save sharp               (igual que build-bip-rig.mjs: sharp NO
//   node scripts/build-web-assets.mjs    es dependencia del proyecto)
//
// Por qué: la barra pedía el logotipo horizontal de 1584 px (160 KB) para
// pintarlo a 34 px de alto, y la tarjeta de invitado de la portada, el Bip de
// soporte de 2000 px (1,5 MB) para pintarlo a 200 de ancho, también en el
// móvil. Las carpetas `Resized/` del kit no sirven: van en cuadrado, con el
// logotipo flotando en medio de mucho aire.
//
// Cada imagen sale a unas tres veces su tamaño en pantalla —nítida en una
// pantalla retina— y con el mismo encuadre que el original: sin recortar, que
// las plantillas tienen los márgenes medidos sobre él. El resultado va a
// `public/assets_web/`, que es lo único que enlazan las plantillas.

import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sharp = loadSharp();
function loadSharp() {
  for (const from of [import.meta.url, pathToFileURL(join(process.cwd(), 'x.js')).href]) {
    try { return createRequire(from)('sharp'); } catch { /* siguiente */ }
  }
  console.error('Falta sharp: `npm i --no-save sharp` (ver la cabecera de este script).');
  process.exit(1);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'assets_web');

const BIPSY = 'assets_bipsy/Combination Marks';
const SYMBOL = 'assets_bipsy/Brand Marks';
const BUSINESS = 'assets_bipsy_business/Combination Marks';

/** [salida, original, { height } | { width }] */
const JOBS = [
  // Barra, cabecera de búsqueda, pie y páginas de estado: de 26 a 34 de alto.
  ['bipsy-horizontal-mint.webp', `${BIPSY}/combinationmark_mint_horizontal_nobackground.webp`, { height: 104 }],
  ['bipsy-horizontal-carbon.webp', `${BIPSY}/combinationmark_carbon_horizontal_nobackground.webp`, { height: 104 }],
  // Registro y acceso del equipo: 108 de alto.
  ['bipsy-vertical-mint.webp', `${BIPSY}/combinationmark_mint_vertical_nobackground.webp`, { height: 324 }],
  ['bipsy-vertical-carbon.webp', `${BIPSY}/combinationmark_carbon_vertical_nobackground.webp`, { height: 324 }],
  // Iniciar sesión: el símbolo solo, a 76 de alto, como en la app.
  ['bipsy-symbol-mint.webp', `${SYMBOL}/mint_symbol_nobackground.webp`, { height: 228 }],
  ['bipsy-symbol-carbon.webp', `${SYMBOL}/carbon_symbol_nobackground.webp`, { height: 228 }],
  // La tarjeta de Bipsy Business en la portada: 30 de alto.
  ['business-horizontal-dark.webp', `${BUSINESS}/combinationmark_horizontal_dark_nobackground.webp`, { height: 90 }],
  ['business-horizontal-light.webp', `${BUSINESS}/combinationmark_horizontal_light_nobackground.webp`, { height: 90 }],
  // Bip: 200 de ancho en la tarjeta de invitado y 232 de alto en las páginas
  // de estado.
  ['bip-support.webp', 'assets_bip/bip_support.webp', { width: 640 }],
  ['bip-booking.webp', 'assets_bip/bip_booking.webp', { width: 640 }],
  // El botón de la App Store venía a 3840 px para pintarse a 40 de alto.
  ['app-store.webp', 'assets_apps/download_app_store.webp', { height: 120 }],
  // Giralabs en el pie: 20 de alto. El original pasaba de 40 KB por tema.
  ['giralabs-wordmark-dark.webp', 'assets_giralabs/giralabs_wordmark_dark.webp', { height: 60 }],
  ['giralabs-wordmark-light.webp', 'assets_giralabs/giralabs_wordmark_light.webp', { height: 60 }],
  // Bip saludando en la portada de escritorio: 400–500 de alto. Es el LCP de
  // la página, y el original de 268 KB lo retrasaba a 2,5 s.
  ['bip-hello-500.webp', 'assets_bip/bip_hello.webp', { height: 500 }],
  ['bip-hello-1000.webp', 'assets_bip/bip_hello.webp', { height: 1000 }],
  // Las capturas de las apps en la portada: el 58 % de la tarjeta, unos 200 px
  // en el móvil y 350 en el ordenador. El original es de 1414; van dos tallas
  // para el `srcset`.
  ...['bipsy_dark', 'bipsy_light', 'bipsy_business_dark', 'bipsy_business_light'].flatMap(n => [
    [`${n.replaceAll('_', '-')}-480.webp`, `assets_apps/${n}.webp`, { width: 480 }],
    [`${n.replaceAll('_', '-')}-960.webp`, `assets_apps/${n}.webp`, { width: 960 }],
  ]),
];

mkdirSync(OUT, { recursive: true });

for (const [name, src, size] of JOBS) {
  const from = join(PUBLIC, src);
  const to = join(OUT, name);
  await sharp(from)
    .resize({ ...size, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(to);
  const kb = (n) => `${Math.round(statSync(n).size / 1024)} KB`;
  console.log(`${name.padEnd(32)} ${kb(from).padStart(8)} → ${kb(to)}`);
}
