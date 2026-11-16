import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** The public origin. Canonicals, og:url and structured data always point here, never at a preview. */
export const SITE_URL = 'https://bipsy.es';

/**
 * What a page tells search engines and link previews about itself.
 *
 * Everything is optional: what a page leaves out falls back to the site-wide
 * values in `index.html`.
 */
export interface PageSeo {
  /** Tab title, shown as «{title} · Bipsy». Left out: the site title from `index.html`. */
  title?: string;
  /** Title used as is, for pages whose title already carries the brand. Wins over [title]. */
  fullTitle?: string;
  /** Meta description. Left out: the site-wide one. */
  description?: string;
  /**
   * Path for the canonical URL and og:url (`/negocio/luna-3`). Query and
   * fragment are dropped. Left out: the address bar's path, which the router
   * has already updated by the time a page is built.
   */
  path?: string;
  /** Absolute URL of the preview image. Left out: `og-image.jpg`. */
  image?: string;
  /** Keep the page out of search results. Also drops the canonical. */
  noindex?: boolean;
  /**
   * JSON-LD blocks, each one injected as its own `<script type="application/ld+json">`.
   * Or a loader, for data that should stay out of the initial bundle (the
   * home's): it is written when it arrives, if the page is still the same.
   */
  jsonLd?: object[] | (() => Promise<object[]>);
}

/** `https://bipsy.es` + [path], with query and fragment dropped. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${canonicalPathOf(path)}`;
}

/**
 * The path a URL should be indexed under: no query, no fragment, no matrix
 * params and no trailing slash. `/buscar?q=corte` and `/buscar/` are `/buscar`.
 */
export function canonicalPathOf(url: string): string {
  const path = url.split(/[?#;]/)[0].replace(/\/+$/, '');
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/** Meta tags this service owns. */
const MANAGED_TAGS: readonly string[] = [
  'description',
  'og:type',
  'og:title',
  'og:description',
  'og:url',
  'og:image',
  'og:image:type',
  'og:image:width',
  'og:image:height',
  'og:image:alt',
  'twitter:title',
  'twitter:description',
];

/** Open Graph tags are named by `property`, the rest by `name`. */
function attrOf(key: string): 'name' | 'property' {
  return key.startsWith('og:') ? 'property' : 'name';
}

/** Marks the JSON-LD scripts this service injected, so it only ever removes its own. */
const JSON_LD_ATTR = 'data-page-jsonld';

/**
 * Título de la pestaña y `noindex` para las pantallas que no son contenido:
 * mantenimiento, acceso del equipo, página no encontrada y errores.
 *
 * Also the page's SEO: meta description, canonical, Open Graph / Twitter
 * tags and JSON-LD ([apply]). Whatever a page sets is undone when it leaves,
 * so the next page never inherits the previous one's canonical or structured
 * data.
 *
 * El resto de la web vive con el título de `index.html`, así que quien cambia
 * algo aquí tiene que devolverlo al irse. Por eso [set] entrega la función que
 * lo deshace.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  // No Router here: the router builds the title strategy, which needs this
  // service, so injecting it back would be a dependency cycle.
  private readonly document = inject(DOCUMENT);

  /** El de `index.html`, leído antes de que nadie lo toque. */
  private readonly defaultTitle = this.title.getTitle();

  /**
   * The site-wide tags from `index.html`, read before anyone touches them.
   * og:url is not one of them: it only makes sense next to a canonical.
   */
  private readonly defaultTags = new Map<string, string | null>(
    MANAGED_TAGS.map(key => [
      key,
      key === 'og:url' ? null : this.meta.getTag(`${attrOf(key)}="${key}"`)?.content ?? null,
    ]),
  );

  /** A quién pertenece lo que hay puesto ahora mismo. */
  private owner = 0;

  constructor() {
    // `index.html` carries the home's canonical so crawlers that do not run
    // JavaScript still get it. On any other address it would be wrong until
    // the page sets its own (a business page waits for the API), and a
    // canonical pointing at the home tells Google the page is a duplicate of
    // it. So it only survives a first load of `/`.
    if (canonicalPathOf(this.document.location?.pathname ?? '/') !== '/') {
      this.writeCanonical(null);
      this.meta.removeTag('property="og:url"');
    }
  }

  /**
   * Pone el título y, si se pide, `noindex`. Devuelve cómo deshacerlo.
   *
   * Deshacer no hace nada si entretanto otra pantalla ha puesto lo suyo: al
   * cambiar de una a otra, la que se va se destruye a veces después de que la
   * nueva haya llegado, y sin esto le borraba el título.
   */
  set(title: string, noindex = false): () => void {
    return this.apply({ title, noindex });
  }

  /**
   * Sets everything [seo] describes and returns how to undo it, with the same
   * ownership rule as [set]: undoing does nothing once another page has
   * applied its own. Calling it again from the same page simply replaces
   * what it had set (a business page does, once its services arrive).
   */
  apply(seo: PageSeo): () => void {
    const ticket = ++this.owner;
    const title = seo.fullTitle ?? (seo.title ? `${seo.title} · Bipsy` : this.defaultTitle);
    this.title.setTitle(title);

    if (seo.noindex) {
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
    } else {
      this.meta.removeTag('name="robots"');
    }

    const url = seo.noindex ? null : absoluteUrl(seo.path ?? this.document.location.pathname);
    const description = seo.description ?? this.defaultTags.get('description') ?? null;
    const tags = new Map(this.defaultTags);
    tags.set('og:title', title);
    tags.set('twitter:title', title);
    tags.set('og:url', url);
    if (seo.description) {
      tags.set('description', description);
      tags.set('og:description', description);
      tags.set('twitter:description', description);
    }
    if (seo.image) {
      // The size and type in index.html describe og-image.jpg, not this one.
      tags.set('og:image', seo.image);
      tags.set('og:image:type', null);
      tags.set('og:image:width', null);
      tags.set('og:image:height', null);
      tags.set('og:image:alt', seo.title ?? title);
    }
    this.writeTags(tags);
    this.writeCanonical(url);
    if (typeof seo.jsonLd === 'function') {
      this.writeJsonLd([]);
      seo.jsonLd().then(
        blocks => {
          if (this.owner === ticket) this.writeJsonLd(blocks);
        },
        () => { /* Without it the page still works; it only loses the rich data. */ },
      );
    } else {
      this.writeJsonLd(seo.jsonLd ?? []);
    }

    return () => {
      if (this.owner !== ticket) {
        return;
      }
      this.restoreDefaults();
    };
  }

  /** Vuelve al título de `index.html` y deja sin efecto lo que haya pendiente de deshacer. */
  reset(): void {
    ++this.owner;
    this.restoreDefaults();
  }

  /**
   * Back to `index.html`: its title and tags, no robots, and neither a
   * canonical nor structured data, which would belong to the page that left.
   */
  private restoreDefaults(): void {
    this.title.setTitle(this.defaultTitle);
    this.meta.removeTag('name="robots"');
    this.writeTags(this.defaultTags);
    this.writeCanonical(null);
    this.writeJsonLd([]);
  }

  private writeTags(values: ReadonlyMap<string, string | null>): void {
    for (const key of MANAGED_TAGS) {
      const attr = attrOf(key);
      const content = values.get(key);
      if (content) {
        this.meta.updateTag({ [attr]: key, content });
      } else {
        this.meta.removeTag(`${attr}="${key}"`);
      }
    }
  }

  private writeCanonical(url: string | null): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!url) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      head.appendChild(link);
    }
    link.href = url;
  }

  private writeJsonLd(blocks: object[]): void {
    const head = this.document.head;
    head.querySelectorAll(`script[${JSON_LD_ATTR}]`).forEach(script => script.remove());
    for (const block of blocks) {
      const script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(JSON_LD_ATTR, '');
      // `<` escaped: a business called «</script>» must not end the block if
      // this head is ever serialised (prerender, SSR).
      script.textContent = JSON.stringify(block).replace(/</g, '\\u003c');
      head.appendChild(script);
    }
  }
}

/**
 * El título de cada ruta, de su `title` en `app.routes.ts`.
 *
 * Pasa por [PageMetaService] y no por `Title` directamente para no pisarse
 * con las páginas que ponen el suyo (la ficha de un negocio, no encontrada,
 * error): esas rutas no llevan `title`, y aquí no se toca nada. Las que
 * quieren el título general de la web lo piden con `data: { defaultTitle: true }`.
 *
 * Routes can also carry their SEO in `data: { seo: PageSeo }` (the home and
 * Buscar do): it is applied here with the route's path as canonical. That is
 * what makes it work for the home, which is kept alive and so is never
 * rebuilt when coming back to it.
 */
@Injectable({ providedIn: 'root' })
export class BipsyTitleStrategy extends TitleStrategy {
  private readonly meta = inject(PageMetaService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const seo = route.data['seo'] as PageSeo | undefined;
    const title = this.buildTitle(snapshot);
    if (title || seo) {
      this.meta.apply({ title, ...seo, path: canonicalPathOf(snapshot.url) });
      return;
    }
    if (route.data['defaultTitle']) {
      this.meta.reset();
    }
  }
}
