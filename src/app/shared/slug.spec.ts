import { businessBookingPath, businessPath, businessShareUrl, businessSlug } from './slug';

describe('business slug', () => {
  it('prefers the slug the backend assigned', () => {
    expect(businessSlug({ id: 3, name: 'Barbería Pepe', slug: 'barberia-pepe' })).toBe('barberia-pepe');
  });

  it('falls back to the legacy name-id format when there is no slug', () => {
    expect(businessSlug({ id: 3, name: 'Barbería Pepe' })).toBe('barberia-pepe-3');
    expect(businessSlug({ id: 3 })).toBe('3');
  });

  it('builds route segments and the shareable url from the slug', () => {
    const business = { id: 3, name: 'Barbería Pepe', slug: 'barberia-pepe' };
    expect(businessPath(business)).toEqual(['/negocio', 'barberia-pepe']);
    expect(businessBookingPath(business)).toEqual(['/negocio', 'barberia-pepe', 'reservar']);
    expect(businessShareUrl('https://bipsy.es', business)).toBe('https://bipsy.es/negocio/barberia-pepe');
  });
});
