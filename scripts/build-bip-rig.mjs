// Corta el Bip de soporte (public/assets_bip/bip_support.webp) en las capas que
// anima `app-bip-rig`. Hay que volver a lanzarlo si se cambia el dibujo.
//
//   npm i --no-save sharp               (sharp NO es dependencia del proyecto:
//   node scripts/build-bip-rig.mjs       es un módulo nativo y solo lo usa este
//                                        script, a mano, muy de vez en cuando)
//
// Si no está en el `node_modules` del proyecto, `sharp` se busca también en la
// carpeta desde la que se lanza el script: vale con tenerlo instalado en
// cualquier carpeta de trabajo y lanzarlo desde allí con la ruta completa.
//
// Opciones: --check comprueba el corte, --overlay pinta las máscaras sobre el
// dibujo (rig/support/_mask.png y _body.png, que NO hay que subir), --lossless
// no cuantiza.
//
// ---------------------------------------------------------------------------
// Cómo funciona
//
// El dibujo es una imagen fija: no hay modelo 3D del que sacar otra pose, así
// que el movimiento tiene que salir de la propia imagen. Se puede porque Bip
// son cuatro materiales planos —piel verde, sudadera y silla negras, portátil
// gris, mesa de madera— y casi todo se separa solo:
//
//  * Las manos son manchas de piel sueltas: se localizan por conectividad a
//    partir de un punto que cae dentro, y su borde es un borde de color, que
//    se toma exacto.
//  * La cabeza es todo lo que hay por encima de una línea trazada a mano
//    —orejas, diadema, auriculares y micro incluidos, que tienen que girar con
//    ella— más la mancha de piel de la cara, que baja hasta la barbilla. La
//    línea solo pasa por fondo transparente, por dentro de la propia cara o
//    por negro contra negro (el micro sobre la capucha), que es donde un corte
//    no se ve. Ese es todo el truco: el borde solo tiene que ser exacto donde
//    se puede ver.
//  * Lo que queda debajo de una capa que se mueve se reconstruye a partir de
//    lo que la rodea, para que tenga algo sobre lo que moverse. Solo llegan a
//    destaparse los pocos píxeles que hay junto a un borde.
//  * Los párpados no existen en el dibujo: son la piel de alrededor de cada
//    ojo, extendida por encima de él. En reposo están plegados (escala 0).
//
// Apiladas de atrás adelante, las capas devuelven el dibujo original; --check
// lo mide, a tamaño completo y otra vez con los ficheros ya publicados. Los
// números que imprime al final son los `origin` de `bip-rig.data.ts`.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
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
const CHECK = process.argv.includes('--check');
const LOSSLESS = process.argv.includes('--lossless');
const OVERLAY = process.argv.includes('--overlay');

const SRC = join(ROOT, 'public/assets_bip/bip_support.webp');
const OUT = join(ROOT, 'public/assets_bip/rig/support');

/** Ancho al que se publican las capas. La página enseña a Bip a unos 232 px
 *  CSS: 720 cubre de sobra una pantalla 3×, y a tamaño completo (2000) cada
 *  capa costaría ocho veces más memoria de textura sin que se note. */
const OUT_WIDTH = 720;

// ---------------------------------------------------------------------------
// Las medidas, en píxeles del dibujo original (2000 × 2000).
const FIG = {
  head: {
    // Todo lo opaco de aquí dentro es cabeza. El borde de abajo, de derecha a
    // izquierda: por debajo del micro (negro sobre el negro de la capucha),
    // por dentro de la cara, y por el hueco transparente que queda entre el
    // auricular izquierdo y el respaldo de la silla.
    poly: [[300, 0], [1420, 0], [1420, 1002], [1160, 1002], [1125, 996], [1100, 985],
           [700, 905], [645, 886], [300, 885]],
    // Un punto de la cara: su mancha de piel completa el contorno hasta la
    // barbilla, donde el borde con la capucha es un borde de color.
    seed: [1000, 600],
    // El cuello, dentro de la capucha: la cabeza gira sobre él.
    pivot: [975, 1050],
    // Detrás de la cabeza hay capucha y respaldo solo cerca del borde; más
    // adentro no hay nada, y rellenarlo dejaría un cuerpo fantasma.
    fillReach: 44,
  },
  // El pulgar hacia arriba. Gira sobre la muñeca, que se pierde en la manga.
  thumb: { seed: [660, 1100], pivot: [655, 1195], grow: 3 },
  // La mano que teclea, que asoma por detrás de la tapa del portátil.
  typing: { seed: [1200, 1280], pivot: [1228, 1232], grow: 2 },
  // La tapa del portátil va DELANTE de esa mano. Su borde izquierdo está
  // medido sobre el dibujo: (1246, 1200) → (1202, 1380). Solo hace falta la
  // franja junto a la mano; el resto de la tapa se queda en el cuerpo. Los
  // otros tres lados caen en zonas lisas (tapa arriba y a la derecha, madera
  // abajo): un corte que cruza un borde con contraste se nota al reducir.
  lid: { poly: [[1262, 1140], [1380, 1140], [1380, 1450], [1188, 1450]] },
  // Las hojas de la planta: lo verde de esta caja. Giran sobre la base.
  plant: { box: [1640, 1070, 1880, 1262], pivot: [1766, 1250], fillReach: 14 },
  // Los ojos, para los párpados: un punto dentro de cada uno y la caja de la
  // que no puede salirse.
  eyes: [
    { key: 'lid-left', seed: [860, 780], box: [770, 670, 950, 880] },
    { key: 'lid-right', seed: [1175, 790], box: [1095, 685, 1255, 890] },
  ],
};

// ---------------------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const byte = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

const { data: src, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
mkdirSync(OUT, { recursive: true });

const rgbAt = (p) => [src[p * 4], src[p * 4 + 1], src[p * 4 + 2]];
const alphaAt = (p) => src[p * 4 + 3] / 255;
const at = (x, y) => y * W + x;
// Piel: más verde que rojo y que azul, y no tan oscura como la diadema, que
// también tira a verde. La sombra bajo la barbilla (91,122,87) sigue siendo
// piel; el negro verdoso de los auriculares (35,50,34), no.
const skinAt = (p) => {
  const [r, g, b] = rgbAt(p);
  return clamp01((g - (r + b) / 2 - 10) / 8) * clamp01((luma(r, g, b) - 58) / 16);
};

const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Mancha conectada a `seed` de los píxeles que cumplen `test`, sin salir de `box`. */
function flood(seed, test, box = [0, 0, W - 1, H - 1]) {
  const mask = new Uint8Array(N);
  const stack = [at(seed[0], seed[1])];
  if (!test(stack[0])) throw new Error(`[rig] la semilla ${seed} no cae donde debería`);
  mask[stack[0]] = 1;
  while (stack.length) {
    const p = stack.pop(), x = p % W, y = (p / W) | 0;
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (!inBox(xx, yy, box)) continue;
      const q = at(xx, yy);
      if (!mask[q] && test(q)) { mask[q] = 1; stack.push(q); }
    }
  }
  return mask;
}

/** Cierra los agujeros de una máscara: lo que queda encerrado es suyo. */
function fillHoles(mask) {
  const [x0, y0, x1, y1] = boundsOf(mask);
  const seen = new Uint8Array(N), queue = [];
  const push = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return;
    const p = at(x, y);
    if (seen[p] || mask[p]) return;
    seen[p] = 1; queue.push(p);
  };
  for (let x = x0; x <= x1; x++) { push(x, y0); push(x, y1); }
  for (let y = y0; y <= y1; y++) { push(x0, y); push(x1, y); }
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], x = p % W, y = (p / W) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = at(x, y);
    if (!seen[p] && alphaAt(p) > 0) mask[p] = 1;
  }
  return mask;
}

function boundsOf(mask) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < N; p++) {
    if (!mask[p]) continue;
    const x = p % W, y = (p / W) | 0;
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

/** Crece la máscara `r` píxeles (cuadrado, separable), solo sobre lo opaco. */
function dilate(mask, r, onlyOpaque = true) {
  const tmp = new Uint8Array(N), out = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let d = -r; d <= r && !v; d++) { const xx = x + d; if (xx >= 0 && xx < W && mask[at(xx, y)]) v = 1; }
    tmp[at(x, y)] = v;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    for (let d = -r; d <= r && !v; d++) { const yy = y + d; if (yy >= 0 && yy < H && tmp[at(x, yy)]) v = 1; }
    out[at(x, y)] = v && (!onlyOpaque || alphaAt(at(x, y)) > 0) ? 1 : 0;
  }
  return out;
}

// ---- máscaras --------------------------------------------------------------
// Todas crecen un par de píxeles: el último anillo de cualquier cosa está
// mezclado con lo que tiene detrás y no pasa la prueba de color, y si se queda
// en el cuerpo es un contorno punteado de donde estaba la mano.
const isSkin = (p) => alphaAt(p) > 0.5 && skinAt(p) > 0.5;

// Cabeza.
const face = fillHoles(flood(FIG.head.seed, isSkin));
const headM = dilate(face, 2);
for (let p = 0; p < N; p++) {
  if (alphaAt(p) > 0 && inPoly(p % W, (p / W) | 0, FIG.head.poly)) headM[p] = 1;
}

// Manos.
const thumbM = dilate(fillHoles(flood(FIG.thumb.seed, isSkin)), FIG.thumb.grow);
const typingM = dilate(fillHoles(flood(FIG.typing.seed, isSkin)), FIG.typing.grow);
for (const [name, m] of [['thumb', thumbM], ['typing', typingM]]) {
  for (let p = 0; p < N; p++) if (m[p] && headM[p]) throw new Error(`[rig] ${name} toca la cabeza`);
}

// Tapa del portátil: un polígono, y nada de lo que sea piel.
const lidM = new Uint8Array(N);
{
  const xs = FIG.lid.poly.map((q) => q[0]), ys = FIG.lid.poly.map((q) => q[1]);
  for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
    const p = at(x, y);
    if (alphaAt(p) > 0 && inPoly(x, y, FIG.lid.poly) && !isSkin(p)) lidM[p] = 1;
  }
}

// Planta: lo verde de su caja. Las hojas son más amarillas que la piel, pero
// en esa caja no hay otra cosa verde, así que vale la misma idea, algo más
// tolerante con el tallo, que es oscuro.
const plantM0 = new Uint8Array(N);
{
  const [x0, y0, x1, y1] = FIG.plant.box;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const p = at(x, y), [r, g, b] = rgbAt(p);
    if (alphaAt(p) > 0.5 && g - (r + b) / 2 > 12 && luma(r, g, b) > 45) plantM0[p] = 1;
  }
}
const plantM = dilate(plantM0, 2);

// Ojos: lo oscuro (y el brillo blanco) que encierra la piel alrededor de la
// semilla.
const eyeMasks = FIG.eyes.map((e) => dilate(fillHoles(flood(e.seed, (p) => !isSkin(p), e.box)), 3));
eyeMasks.forEach((m, i) => {
  const [x0, y0, x1, y1] = boundsOf(m), b = FIG.eyes[i].box;
  if (x0 <= b[0] || y0 <= b[1] || x1 >= b[2] || y1 >= b[3]) throw new Error(`[rig] el ojo ${i} se sale de su caja`);
});

// Las capas que se mueven y destapan cuerpo, de atrás adelante.
const MOVING = [
  { key: 'plant', mask: plantM, reach: FIG.plant.fillReach },
  { key: 'typing', mask: typingM, reach: Infinity },
  { key: 'head', mask: headM, reach: FIG.head.fillReach },
  { key: 'thumb', mask: thumbM, reach: Infinity },
];
const ownerOf = new Int8Array(N).fill(-1);
MOVING.forEach((l, i) => { for (let p = 0; p < N; p++) if (l.mask[p]) ownerOf[p] = i; });

// ---- reconstruir lo que hay debajo ----------------------------------------
// Antes de decidir qué se da por conocido, las máscaras crecen otro poco: los
// píxeles de justo fuera de una mano son su propio borde suave, y dárselos al
// relleno pinta su fantasma sobre la sudadera.
const hidden = new Uint8Array(N);
for (let p = 0; p < N; p++) hidden[p] = ownerOf[p] >= 0 ? 1 : 0;
const grown = dilate(hidden, 6, false);
const known = new Float32Array(N);
for (let p = 0; p < N; p++) known[p] = alphaAt(p) > 0.6 && !grown[p] ? 1 : 0;
const { fill, dist } = reconstruct(src, known, W, H);

// Hasta dónde se deja opaco el relleno. Las manos están enteras sobre el
// cuerpo y se rellena todo; la cabeza y la planta tienen detrás sobre todo
// fondo, y ahí un alcance corto cierra la junta sin inventar nada.
const backing = (p) => {
  const reach = MOVING[ownerOf[p]].reach;
  if (reach === Infinity) return 1;
  const d = Math.sqrt(dist[p]), t = (d - reach + 8) / 16;
  return t <= 0 ? 1 : t >= 1 ? 0 : 1 - t * t * (3 - 2 * t);
};

// Los párpados: la piel de alrededor de cada ojo, llevada por encima de él.
const lidFill = (() => {
  const eyesGrown = new Uint8Array(N);
  for (const m of eyeMasks) { const g = dilate(m, 8); for (let p = 0; p < N; p++) if (g[p]) eyesGrown[p] = 1; }
  const k = new Float32Array(N);
  for (let p = 0; p < N; p++) k[p] = face[p] && isSkin(p) && !eyesGrown[p] ? 1 : 0;
  return pushPull(src, k, W, H);
})();

// ---- emitir ----------------------------------------------------------------
const blank = () => Buffer.alloc(N * 4);
const put = (buf, p, rgb, a) => {
  if (a <= 0.002) return;
  buf[p * 4] = byte(rgb[0]); buf[p * 4 + 1] = byte(rgb[1]); buf[p * 4 + 2] = byte(rgb[2]);
  buf[p * 4 + 3] = Math.round(clamp01(a) * 255);
};

const body = blank(), lid = blank();
const bufs = Object.fromEntries(MOVING.map((l) => [l.key, blank()]));
const eyeBufs = FIG.eyes.map(() => blank());

for (let p = 0; p < N; p++) {
  const a = alphaAt(p);
  if (a === 0) continue;
  const rgb = rgbAt(p), o = ownerOf[p];
  if (o >= 0) {
    // La capa se lleva el píxel tal cual, y el cuerpo se queda con el relleno:
    // encima va el original, así que en reposo no cambia nada.
    put(bufs[MOVING[o].key], p, rgb, a);
    put(body, p, [fill[p * 3], fill[p * 3 + 1], fill[p * 3 + 2]], a >= 0.999 ? backing(p) : 0);
  } else {
    put(body, p, rgb, a);
  }
  // La tapa repite lo que ya hay debajo, sea cuerpo o mano: mismo color,
  // opaca, y no altera el resultado.
  if (lidM[p]) put(lid, p, rgb, a);
  eyeMasks.forEach((m, i) => { if (m[p]) put(eyeBufs[i], p, [lidFill[p * 3], lidFill[p * 3 + 1], lidFill[p * 3 + 2]], 1); });
}

// De atrás adelante. Los párpados van con la cabeza y en reposo no se ven.
const layers = [
  ['body', body], ['plant', bufs.plant], ['typing', bufs.typing], ['lid', lid],
  ['head', bufs.head], ['thumb', bufs.thumb],
];
const hiddenAtRest = FIG.eyes.map((e, i) => [e.key, eyeBufs[i]]);

function stack(list, w, h) {
  const dst = Buffer.alloc(w * h * 4);
  for (const buf of list) for (let p = 0; p < w * h; p++) {
    const i = p * 4, av = buf[i + 3] / 255;
    if (av <= 0) continue;
    const da = dst[i + 3] / 255, oa = av + da * (1 - av);
    for (let c = 0; c < 3; c++) dst[i + c] = Math.round((buf[i + c] * av + dst[i + c] * da * (1 - av)) / oa);
    dst[i + 3] = Math.round(oa * 255);
  }
  return dst;
}
// Se compara lo que ve el ojo: las dos imágenes aplanadas sobre el mismo
// fondo, para que el color —arbitrario— de un píxel transparente no cuente.
function compare(a, b, w, h, label) {
  const BG = 242;
  let worst = 0, where = null, over = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, aa = a[i + 3] / 255, ba = b[i + 3] / 255;
    let d = 0;
    for (let c = 0; c < 3; c++)
      d = Math.max(d, Math.abs((a[i + c] * aa + BG * (1 - aa)) - (b[i + c] * ba + BG * (1 - ba))));
    if (d > 6) over++;
    if (d > worst) { worst = d; where = [p % w, (p / w) | 0]; }
  }
  console.log(`  check (${label}): peor diferencia visible ${worst.toFixed(1)} en ${where}, píxeles por encima de 6: ${over}`);
}

if (CHECK) compare(stack(layers.map((l) => l[1]), W, H), src, W, H, 'tamaño completo');

if (OVERLAY) {
  const TINT = { plant: [255, 200, 60], typing: [90, 150, 255], head: [255, 255, 255], thumb: [255, 90, 90] };
  const vis = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) {
    const a = alphaAt(p);
    const c = rgbAt(p).map((v) => v * a + 238 * (1 - a));
    const mix = (t, k) => { for (let i = 0; i < 3; i++) c[i] = c[i] * (1 - k) + t[i] * k; };
    if (ownerOf[p] >= 0) mix(TINT[MOVING[ownerOf[p]].key], 0.5);
    if (lidM[p]) mix([255, 0, 255], 0.35);
    eyeMasks.forEach((m) => { if (m[p]) mix([255, 255, 0], 0.6); });
    put(vis, p, c, 1);
  }
  await sharp(vis, { raw: { width: W, height: H, channels: 4 } }).png().toFile(join(OUT, '_mask.png'));
  // Y el cuerpo solo, que es donde se ve si el relleno ha quedado limpio.
  await sharp(body, { raw: { width: W, height: H, channels: 4 } }).png().toFile(join(OUT, '_body.png'));
  console.log('  _mask.png y _body.png escritos (no subirlos)');
}

const opts = LOSSLESS ? { lossless: true, effort: 6 } : { quality: 88, alphaQuality: 100, effort: 6 };
const outH = Math.round(H * OUT_WIDTH / W);
let total = 0;
const published = [];
for (const [key, buf] of [...layers, ...hiddenAtRest]) {
  const file = join(OUT, `${key}.webp`);
  const { size } = await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .resize({ width: OUT_WIDTH, kernel: 'lanczos3' }).webp(opts).toFile(file);
  total += size;
  if (layers.some((l) => l[0] === key)) published.push(file);
  console.log(`  ${`${key}.webp`.padEnd(16)} ${(size / 1024).toFixed(1)} kB`);
}
console.log(`  total ${(total / 1024).toFixed(1)} kB — ${W}x${H}, publicado a ${OUT_WIDTH}x${outH}`);

if (CHECK) {
  // Otra vez, con lo que de verdad se va a servir: los ficheros ya reducidos
  // y comprimidos, contra el original reducido igual. La referencia sale del
  // mismo búfer y no del .webp: al reducir un .webp sharp recorta ya al
  // decodificar, y eso solo ya da diferencias que no son del corte. Lo que
  // queda aquí es compresión (compárese con --lossless) y el puñado de
  // píxeles de borde donde dos capas reducidas por separado se mezclan.
  const raws = [];
  for (const f of published) raws.push(await sharp(f).ensureAlpha().raw().toBuffer());
  const ref = await sharp(src, { raw: { width: W, height: H, channels: 4 } })
    .resize({ width: OUT_WIDTH, kernel: 'lanczos3' }).raw().toBuffer();
  compare(stack(raws, OUT_WIDTH, outH), ref, OUT_WIDTH, outH, 'publicado');
}

const pct = ([x, y]) => `${(x / W * 100).toFixed(2)}% ${(y / H * 100).toFixed(2)}%`;
console.log(`  aspect ${OUT_WIDTH} / ${outH}`);
console.log('  origin:');
console.log(`    head      ${pct(FIG.head.pivot)}`);
console.log(`    thumb     ${pct(FIG.thumb.pivot)}`);
console.log(`    typing    ${pct(FIG.typing.pivot)}`);
console.log(`    plant     ${pct(FIG.plant.pivot)}`);
// Cada párpado baja desde el borde de arriba de su ojo.
eyeMasks.forEach((m, i) => {
  const [x0, y0, x1] = boundsOf(m);
  console.log(`    ${FIG.eyes[i].key.padEnd(9)} ${pct([(x0 + x1) / 2, y0])}`);
});

// ---------------------------------------------------------------------------
// Lo que va detrás de una capa que se mueve.
//
// Dos rellenos, mezclados según lo hondo que esté el píxel en el hueco. Cerca
// del borde se usa el píxel conocido más cercano, que prolonga cada material
// tal cual: una interpolación suave ahí promedia negro con madera y deja una
// cinta gris justo donde estaba la mano. Muy adentro de un hueco grande el
// vecino más cercano enseñaría sus costuras, y ahí manda el relleno suave.
// Solo se destapan los primeros píxeles junto a un borde, así que la mitad que
// tiene que estar bien es la de cerca.
function reconstruct(src, known, W, H) {
  const smooth = pushPull(src, known, W, H);
  const { color: near, dist } = nearestKnown(src, known, W, H);
  const fill = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const d = Math.sqrt(dist[p]);
    const t = d <= 6 ? 0 : d >= 30 ? 1 : ((d - 6) / 24) ** 2 * (3 - 2 * (d - 6) / 24);
    for (let c = 0; c < 3; c++) fill[p * 3 + c] = near[p * 3 + c] * (1 - t) + smooth[p * 3 + c] * t;
  }
  return { fill, dist };
}

// 8SSEDT: dos pasadas que arrastran las coordenadas del conocido más cercano.
function nearestKnown(src, known, W, H) {
  const nx = new Int32Array(W * H).fill(-1), ny = new Int32Array(W * H).fill(-1);
  const dist = new Float64Array(W * H).fill(Infinity);
  for (let p = 0; p < W * H; p++) {
    if (known[p] > 0.5) { nx[p] = p % W; ny[p] = (p / W) | 0; dist[p] = 0; }
  }
  const relax = (p, q, x, y) => {
    if (nx[q] < 0) return;
    const dx = x - nx[q], dy = y - ny[q], d = dx * dx + dy * dy;
    if (d < dist[p]) { dist[p] = d; nx[p] = nx[q]; ny[p] = ny[q]; }
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (x > 0) relax(p, p - 1, x, y);
    if (y > 0) relax(p, p - W, x, y);
    if (x > 0 && y > 0) relax(p, p - W - 1, x, y);
    if (x < W - 1 && y > 0) relax(p, p - W + 1, x, y);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const p = y * W + x;
    if (x < W - 1) relax(p, p + 1, x, y);
    if (y < H - 1) relax(p, p + W, x, y);
    if (x < W - 1 && y < H - 1) relax(p, p + W + 1, x, y);
    if (x > 0 && y < H - 1) relax(p, p + W - 1, x, y);
  }
  const color = new Float32Array(W * H * 3);
  for (let p = 0; p < W * H; p++) {
    const q = nx[p] >= 0 ? ny[p] * W + nx[p] : p;
    for (let c = 0; c < 3; c++) color[p * 3 + c] = src[q * 4 + c];
  }
  return { color, dist };
}

// Push-pull: se promedia lo conocido pirámide arriba y se vuelve a bajar
// dentro del hueco. Cada nivel guarda colores sin premultiplicar y un peso de
// cobertura, para que cada paso pondere bien; mezclar sumas ponderadas y sin
// ponderar desborda y vuelve convertido en confeti de colores.
function pushPull(src, known, W, H) {
  const levels = [];
  {
    const c = new Float32Array(W * H * 3), k = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) {
      k[p] = known[p];
      for (let i = 0; i < 3; i++) c[p * 3 + i] = src[p * 4 + i];
    }
    levels.push({ w: W, h: H, c, k });
  }
  for (;;) {
    const prev = levels[levels.length - 1];
    if (prev.w <= 2 || prev.h <= 2) break;
    const nw = Math.ceil(prev.w / 2), nh = Math.ceil(prev.h / 2);
    const c = new Float32Array(nw * nh * 3), k = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sw = 0; const s = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const px = x * 2 + dx, py = y * 2 + dy;
        if (px >= prev.w || py >= prev.h) continue;
        const q = py * prev.w + px, kw = prev.k[q];
        sw += kw;
        for (let i = 0; i < 3; i++) s[i] += prev.c[q * 3 + i] * kw;
      }
      const i = y * nw + x;
      if (sw > 0) { for (let j = 0; j < 3; j++) c[i * 3 + j] = s[j] / sw; k[i] = Math.min(1, sw); }
    }
    levels.push({ w: nw, h: nh, c, k });
  }
  // Bilineal al bajar, o el relleno vuelve hecho bloques.
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], co = levels[l + 1];
    const coarse = (fx, fy, ch) => {
      const x = Math.min(co.w - 1, Math.max(0, fx)), y = Math.min(co.h - 1, Math.max(0, fy));
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const x1 = Math.min(co.w - 1, x0 + 1), y1 = Math.min(co.h - 1, y0 + 1);
      const tx = x - x0, ty = y - y0, g = (xx, yy) => co.c[(yy * co.w + xx) * 3 + ch];
      return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty)
           + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
    };
    for (let y = 0; y < fine.h; y++) for (let x = 0; x < fine.w; x++) {
      const i = y * fine.w + x;
      if (fine.k[i] >= 1) continue;
      const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5, a = fine.k[i];
      for (let ch = 0; ch < 3; ch++) fine.c[i * 3 + ch] = fine.c[i * 3 + ch] * a + coarse(fx, fy, ch) * (1 - a);
      fine.k[i] = 1;
    }
  }
  return levels[0].c;
}
