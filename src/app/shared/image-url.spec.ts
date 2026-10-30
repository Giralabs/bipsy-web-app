import { resolveApiUrl } from '../core/api.service';
import { fixImageUrl } from './image-url';

describe('fixImageUrl', () => {
  const base = resolveApiUrl().replace(/\/$/, '');

  it('vacío o solo espacios → null', () => {
    expect(fixImageUrl(null)).toBeNull();
    expect(fixImageUrl(undefined)).toBeNull();
    expect(fixImageUrl('   ')).toBeNull();
  });

  it('deja intactas las absolutas y los data:', () => {
    expect(fixImageUrl('https://cdn.x/a.webp')).toBe('https://cdn.x/a.webp');
    expect(fixImageUrl('http://x/a.webp')).toBe('http://x/a.webp');
    expect(fixImageUrl('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
  });

  it('resuelve las relativas contra la misma API que ApiService', () => {
    expect(fixImageUrl('/files/business-cover/1.webp')).toBe(`${base}/files/business-cover/1.webp`);
    expect(fixImageUrl('files/a.webp')).toBe(`${base}/files/a.webp`);
    expect(fixImageUrl('  /files/a.webp  ')).toBe(`${base}/files/a.webp`);
  });
});
