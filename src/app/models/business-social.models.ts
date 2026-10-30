import { BusinessResponse } from './bipsy.models';

/**
 * Enlaces públicos del negocio: su web, sus redes y su WhatsApp.
 *
 * Port de `BusinessSocialLinks` (gipsi_api). Vive aparte de `bipsy.models.ts`
 * porque solo la usa la ficha; el campo llega dentro de `BusinessResponse`
 * como `social` y aquí se lee sin tocar el contrato compartido.
 *
 * De las redes llega el USUARIO —«luna_beauty»—, no la dirección: el enlace se
 * compone aquí, para que el día que una red cambie de dominio, como hizo X, se
 * cambie en un sitio. `website` ya trae esquema y `whatsapp` va en formato
 * internacional.
 */
export interface BusinessSocialLinks {
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  x?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
}

export type SocialNetwork = 'website' | 'instagram' | 'facebook' | 'x' | 'tiktok' | 'whatsapp';

export interface SocialLink {
  network: SocialNetwork;
  label: string;
  url: string;
}

/**
 * Las redes que tiene el negocio, ya con su enlace y en el orden de Editar
 * perfil —web, Instagram, Facebook, X, TikTok y WhatsApp—, para que el negocio
 * reconozca su fila. Las que no tiene no salen: un icono apagado no dice nada.
 */
export function businessSocialLinks(business: BusinessResponse): SocialLink[] {
  const social = (business as BusinessResponse & { social?: BusinessSocialLinks | null }).social;
  if (!social) {
    return [];
  }

  const handle = (value?: string | null) => (value ?? '').trim();
  const links: SocialLink[] = [];
  const push = (network: SocialNetwork, label: string, url: string | null) => {
    if (url) links.push({ network, label, url });
  };

  // El servidor la guarda con esquema, pero un enlace sin él se abriría como
  // ruta de Bipsy («/negocio/www.luna.es»): se pone por si acaso.
  const website = handle(social.website);
  push('website', 'Web', website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null);
  push('instagram', 'Instagram', handle(social.instagram) ? `https://instagram.com/${handle(social.instagram)}` : null);
  push('facebook', 'Facebook', handle(social.facebook) ? `https://facebook.com/${handle(social.facebook)}` : null);
  push('x', 'X', handle(social.x) ? `https://x.com/${handle(social.x)}` : null);
  push('tiktok', 'TikTok', handle(social.tiktok) ? `https://tiktok.com/@${handle(social.tiktok)}` : null);
  // wa.me no admite el «+» del formato internacional: solo dígitos.
  const whatsapp = handle(social.whatsapp).replace(/[^0-9]/g, '');
  push('whatsapp', 'WhatsApp', whatsapp ? `https://wa.me/${whatsapp}` : null);
  return links;
}
