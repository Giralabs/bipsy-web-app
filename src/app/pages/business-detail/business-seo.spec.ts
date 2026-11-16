import { BusinessResponse, ScheduleDayResponse, ServiceResponse } from '../../models/bipsy.models';
import {
  businessBreadcrumbJsonLd,
  businessDescription,
  businessJsonLd,
  businessSeo,
  businessTitle,
} from './business-seo';

function business(overrides: Partial<BusinessResponse> = {}): BusinessResponse {
  return {
    id: 3,
    name: 'Barbería Luna',
    autonomous: false,
    address: 'C. Sierpes, 1, Casco Antiguo, 41004 Sevilla, España',
    city: 'Sevilla',
    province: 'Sevilla',
    latitude: 37.39,
    longitude: -5.99,
    phone: '+34 600 000 000',
    coverImageUrl: 'https://api.bipsy.es/files/cover.webp',
    profileImageUrl: 'https://api.bipsy.es/files/logo.webp',
    categories: [{ id: 1, code: 'BARBER', name: 'Barbería', primary: true }],
    ...overrides,
  };
}

const services: ServiceResponse[] = [
  { id: 1, businessId: 3, name: 'Corte', price: 15, duration: 30, active: true },
  { id: 2, businessId: 3, name: 'Consulta', price: 0, duration: 15, active: true },
  { id: 3, businessId: 3, name: 'Retirado', price: 20, duration: 30, active: false },
];

const schedule: ScheduleDayResponse[] = [
  { dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '14:00:00' },
  { dayOfWeek: 'MONDAY', startTime: '16:00:00', endTime: '20:00:00' },
  { dayOfWeek: 'SUNDAY' },
];

// Plain records to read the JSON-LD without a type for every block.
type Json = Record<string, any>;

describe('business-seo', () => {
  it('titles the page «{name} en {city} · Pide cita en Bipsy»', () => {
    expect(businessTitle(business())).toBe('Barbería Luna en Sevilla · Pide cita en Bipsy');
    expect(businessTitle(business({ name: 'Barbería Sevilla Centro' })))
      .toBe('Barbería Sevilla Centro · Pide cita en Bipsy');
    expect(businessTitle(business({ city: undefined, province: undefined })))
      .toBe('Barbería Luna · Pide cita en Bipsy');
  });

  it('only mentions the rating when there are real reviews', () => {
    expect(businessDescription(business())).not.toContain('reseña');
    expect(businessDescription(business({ averageRating: 4.75, reviewCount: 23 })))
      .toContain('4,8 de 5 en 23 reseñas.');
    expect(businessDescription(business({ averageRating: 4, reviewCount: 0 }))).not.toContain('de 5');
  });

  it('uses the most specific type for the category', () => {
    expect((businessJsonLd({ business: business() }) as Json)['@type']).toBe('HairSalon');
    const nails = business({ categories: [{ id: 2, code: 'NAILS', name: 'Uñas', primary: true }] });
    expect((businessJsonLd({ business: nails }) as Json)['@type']).toBe('NailSalon');
    const other = business({ categories: [{ id: 9, code: 'PHOTOGRAPHY', name: 'Fotografía', primary: true }] });
    expect((businessJsonLd({ business: other }) as Json)['@type']).toBe('LocalBusiness');
  });

  it('builds the LocalBusiness from the API fields only', () => {
    const json = JSON.parse(JSON.stringify(businessJsonLd({ business: business(), services, schedule }))) as Json;
    expect(json['url']).toBe('https://bipsy.es/negocio/barberia-luna-3');
    expect(json['telephone']).toBe('+34 600 000 000');
    expect(json['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'C. Sierpes, 1, Casco Antiguo, 41004 Sevilla',
      postalCode: '41004',
      addressLocality: 'Sevilla',
      addressRegion: 'Sevilla',
      addressCountry: 'ES',
    });
    expect(json['geo']).toEqual({ '@type': 'GeoCoordinates', latitude: 37.39, longitude: -5.99 });
    expect(json['aggregateRating']).toBeUndefined();
    expect(json['openingHoursSpecification']).toEqual([
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '09:00', closes: '14:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '16:00', closes: '20:00' },
    ]);
    expect(json['makesOffer']).toEqual([
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Corte' }, price: '15.00', priceCurrency: 'EUR' },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Consulta' } },
    ]);
  });

  it('adds the rating only with reviews', () => {
    const rated = businessJsonLd({ business: business({ averageRating: 4.66, reviewCount: 12 }) }) as Json;
    expect(rated['aggregateRating']).toEqual({
      '@type': 'AggregateRating', ratingValue: 4.7, reviewCount: 12, bestRating: 5, worstRating: 1,
    });
  });

  it('gives no address or coordinates for a business that goes to the customer', () => {
    const json = businessJsonLd({ business: business({ worksAtHome: true, address: undefined }) }) as Json;
    expect(json['address']).toBeUndefined();
    expect(json['geo']).toBeUndefined();
    expect(json['areaServed']).toEqual({ '@type': 'City', name: 'Sevilla' });
  });

  it('leaves out relative images and empty extras', () => {
    const json = JSON.parse(JSON.stringify(businessJsonLd({
      business: business({ coverImageUrl: undefined, profileImageUrl: undefined, phone: undefined }),
    }))) as Json;
    expect(json['image']).toBeUndefined();
    expect(json['telephone']).toBeUndefined();
    expect(json['openingHoursSpecification']).toBeUndefined();
    expect(json['makesOffer']).toBeUndefined();
  });

  it('breadcrumbs Bipsy › business', () => {
    const crumbs = businessBreadcrumbJsonLd(business()) as Json;
    expect(crumbs['itemListElement'].map((item: Json) => item['item']))
      .toEqual(['https://bipsy.es/', 'https://bipsy.es/negocio/barberia-luna-3']);
  });

  it('canonicalises to the current slug', () => {
    const seo = businessSeo({ business: business() });
    expect(seo.path).toBe('/negocio/barberia-luna-3');
    expect(seo.image).toBe('https://api.bipsy.es/files/cover.webp');
    expect(seo.jsonLd?.length).toBe(2);
  });
});
