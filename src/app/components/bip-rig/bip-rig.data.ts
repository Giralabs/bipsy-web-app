/**
 * Las capas del Bip de soporte, tal como las corta `scripts/build-bip-rig.mjs`
 * a partir de `public/assets_bip/bip_support.webp`.
 *
 * ⚠️ Los `origin` NO se tocan a mano: son los que imprime el script al final
 * (el punto sobre el que gira cada pieza, en % de la caja). Si se cambia el
 * dibujo, se relanza el script y se copian aquí.
 */
export interface BipRigLayer {
  /** Nombre del fichero (sin extensión) y sufijo de la clase CSS. */
  key: string;
  /** `transform-origin`. Sin él, la capa no se mueve. */
  origin?: string;
  /** Capas que van pegadas a esta y se mueven con ella. */
  children?: BipRigLayer[];
}

export const BIP_RIG_BASE = 'assets_bip/rig/support/';

/** El dibujo entero, por si alguna capa no llega. */
export const BIP_RIG_FALLBACK = 'assets_bip/bip_support.webp';

/** De atrás adelante. */
export const BIP_RIG_LAYERS: BipRigLayer[] = [
  { key: 'body' },
  { key: 'plant', origin: '88.30% 62.50%' },
  { key: 'typing', origin: '61.40% 61.60%' },
  // La tapa del portátil, delante de la mano que teclea. No se mueve.
  { key: 'lid' },
  {
    key: 'head',
    origin: '48.75% 52.50%',
    // Los párpados: plegados (escala 0) salvo durante el parpadeo.
    children: [
      { key: 'lid-left', origin: '42.95% 34.65%' },
      { key: 'lid-right', origin: '58.67% 35.45%' },
    ],
  },
  { key: 'thumb', origin: '32.75% 59.75%' },
];

/** Cuántas imágenes tienen que haber llegado para enseñar la figura. */
export const BIP_RIG_COUNT = BIP_RIG_LAYERS.reduce((n, l) => n + 1 + (l.children?.length ?? 0), 0);
