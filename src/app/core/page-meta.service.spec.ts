import { TestBed } from '@angular/core/testing';
import { PageMetaService, canonicalPathOf } from './page-meta.service';

function canonical(): string | null {
  return document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null;
}

function jsonLd(): string[] {
  return Array.from(document.head.querySelectorAll('script[data-page-jsonld]')).map(s => s.textContent ?? '');
}

function metaContent(selector: string): string | null {
  return document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content ?? null;
}

describe('canonicalPathOf', () => {
  it('drops query, fragment and trailing slash', () => {
    expect(canonicalPathOf('/buscar?q=corte')).toBe('/buscar');
    expect(canonicalPathOf('/legal/terminos#3')).toBe('/legal/terminos');
    expect(canonicalPathOf('/buscar/')).toBe('/buscar');
    expect(canonicalPathOf('')).toBe('/');
    expect(canonicalPathOf('/?mapa=1')).toBe('/');
  });
});

describe('PageMetaService', () => {
  let service: PageMetaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PageMetaService);
    service.reset();
  });

  afterEach(() => service.reset());

  it('sets title, description, canonical, Open Graph and JSON-LD, and undoes them', () => {
    const release = service.apply({
      fullTitle: 'Luna en Sevilla · Pide cita en Bipsy',
      description: 'Pide cita en Luna.',
      path: '/negocio/luna-3?x=1',
      image: 'https://api.bipsy.es/cover.webp',
      jsonLd: [{ '@type': 'HairSalon', name: '</script>' }],
    });

    expect(document.title).toBe('Luna en Sevilla · Pide cita en Bipsy');
    expect(metaContent('name="description"')).toBe('Pide cita en Luna.');
    expect(metaContent('property="og:description"')).toBe('Pide cita en Luna.');
    expect(metaContent('name="twitter:title"')).toBe('Luna en Sevilla · Pide cita en Bipsy');
    expect(metaContent('property="og:url"')).toBe('https://bipsy.es/negocio/luna-3');
    expect(metaContent('property="og:image"')).toBe('https://api.bipsy.es/cover.webp');
    expect(canonical()).toBe('https://bipsy.es/negocio/luna-3');
    expect(jsonLd().length).toBe(1);
    expect(jsonLd()[0]).not.toContain('</script>');

    release();
    expect(canonical()).toBeNull();
    expect(jsonLd().length).toBe(0);
    expect(metaContent('property="og:url"')).toBeNull();
    expect(metaContent('name="description"')).not.toBe('Pide cita en Luna.');
  });

  it('drops the canonical on noindex pages', () => {
    service.apply({ title: 'Página no encontrada', noindex: true });
    expect(metaContent('name="robots"')).toBe('noindex');
    expect(canonical()).toBeNull();
  });

  it('writes lazily loaded JSON-LD only if the page is still the same', async () => {
    service.apply({ title: 'Inicio', path: '/', jsonLd: () => Promise.resolve([{ home: 1 }]) });
    await Promise.resolve();
    await Promise.resolve();
    expect(jsonLd()).toEqual(['{"home":1}']);

    let resolveLate!: (blocks: object[]) => void;
    service.apply({ path: '/', jsonLd: () => new Promise(resolve => (resolveLate = resolve)) });
    service.apply({ title: 'Buscar', path: '/buscar' });
    resolveLate([{ home: 2 }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(jsonLd()).toEqual([]);
  });

  it('does not undo what a newer page set', () => {
    const releaseOld = service.apply({ title: 'Vieja', path: '/vieja', jsonLd: [{ a: 1 }] });
    service.apply({ title: 'Nueva', path: '/nueva', jsonLd: [{ b: 2 }] });
    releaseOld();
    expect(document.title).toBe('Nueva · Bipsy');
    expect(canonical()).toBe('https://bipsy.es/nueva');
    expect(jsonLd()).toEqual(['{"b":2}']);
  });
});
