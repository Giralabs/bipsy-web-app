import { PageSeo, SITE_URL } from '../../core/page-meta.service';
import {
  BusinessResponse,
  ScheduleDayResponse,
  ServiceResponse,
  primaryCategory,
} from '../../models/bipsy.models';
import { businessSocialLinks } from '../../models/business-social.models';
import { fixImageUrl } from '../../shared/image-url';
import { businessSlug } from '../../shared/slug';

/**
 * SEO of a business page: title, description, canonical and its JSON-LD
 * (`LocalBusiness` + `BreadcrumbList`).
 *
 * **Nothing here is made up.** Every field comes from the API and is left out
 * when the API does not send it: no rating without real reviews, no hours
 * without a published schedule, no price on a service that has none. Google
 * penalises structured data that says more than the page does.
 */

/** What the page has loaded so far. Services and schedule arrive after the business. */
export interface BusinessSeoInput {
  business: BusinessResponse;
  services?: ServiceResponse[];
  schedule?: ScheduleDayResponse[];
}

/**
 * The most specific schema.org type for each category code
 * (`shared/category-icons.ts` has the full list). Codes without a fitting
 * type, or unknown to this build, stay `LocalBusiness`.
 */
const TYPE_BY_CATEGORY: Readonly<Record<string, string>> = {
  BARBER: 'HairSalon',
  BARBERSHOP: 'HairSalon',
  HAIRDRESSER: 'HairSalon',
  NAILS: 'NailSalon',
  ESTHETIC: 'BeautySalon',
  EYEBROWS: 'BeautySalon',
  MAKEUP: 'BeautySalon',
  LASER: 'BeautySalon',
  MASSAGE: 'HealthAndBeautyBusiness',
  TATTOO: 'TattooParlor',
  PHYSIO: 'Physiotherapy',
  DENTAL: 'Dentist',
};

const SCHEMA_DAYS: Readonly<Record<string, string>> = {
  MONDAY: 'https://schema.org/Monday',
  TUESDAY: 'https://schema.org/Tuesday',
  WEDNESDAY: 'https://schema.org/Wednesday',
  THURSDAY: 'https://schema.org/Thursday',
  FRIDAY: 'https://schema.org/Friday',
  SATURDAY: 'https://schema.org/Saturday',
  SUNDAY: 'https://schema.org/Sunday',
};

/** More than this and the block weighs more than it helps. */
const MAX_OFFERS = 50;

export function businessCanonicalPath(business: BusinessResponse): string {
  return `/negocio/${businessSlug(business)}`;
}

/** The town to name: the city, or the province when there is no city. */
function townOf(business: BusinessResponse): string {
  return (business.city ?? business.province ?? '').trim();
}

/** «Barbería Luna en Sevilla», without repeating the town if the name already says it. */
function nameAndTown(business: BusinessResponse): string {
  const town = townOf(business);
  if (!town || business.name.toLowerCase().includes(town.toLowerCase())) {
    return business.name;
  }
  return `${business.name} en ${town}`;
}

function hasRating(business: BusinessResponse): boolean {
  return (business.reviewCount ?? 0) > 0 && (business.averageRating ?? 0) > 0;
}

/** The page title: «{Nombre} en {Ciudad} · Pide cita en Bipsy». */
export function businessTitle(business: BusinessResponse): string {
  return `${nameAndTown(business)} · Pide cita en Bipsy`;
}

/**
 * The meta description, built from what the business has:
 * «Pide cita en Barbería Luna, barbería en Sevilla. 4,8 de 5 en 23 reseñas.
 * Elige servicio, día y hora y reserva online sin llamar.»
 */
export function businessDescription(business: BusinessResponse): string {
  const category = primaryCategory(business)?.name?.trim();
  const town = townOf(business);
  let lead = `Pide cita en ${business.name}`;
  if (category && !business.name.toLowerCase().includes(category.toLowerCase())) {
    lead += `, ${category.toLowerCase()}`;
  }
  if (town) lead += ` en ${town}`;
  if (business.worksAtHome) lead += ' a domicilio';

  const parts = [`${lead}.`];
  if (hasRating(business)) {
    const rating = business.averageRating!.toFixed(1).replace('.', ',');
    const count = business.reviewCount!;
    parts.push(`${rating} de 5 en ${count} ${count === 1 ? 'reseña' : 'reseñas'}.`);
  }
  parts.push('Elige servicio, día y hora y reserva online sin llamar.');
  return parts.join(' ');
}

/** An image URL only if it is absolute: a relative one means nothing to a crawler. */
function absoluteImage(raw?: string | null): string | undefined {
  const url = fixImageUrl(raw);
  return url && /^https?:\/\//.test(url) ? url : undefined;
}

/** «C. Sierpes, 1, 41004 Sevilla, España» → street without the country, its postcode and country. */
function postalAddress(business: BusinessResponse): object | undefined {
  // A business that goes to the customer has no premises: its own address,
  // if it has one, is someone's home.
  if (business.worksAtHome) return undefined;
  const raw = (business.address ?? '').trim();
  const city = business.city?.trim();
  const province = business.province?.trim();
  if (!raw && !city) return undefined;

  // Older businesses stored Google's full address, country included.
  const inSpain = /,\s*españa$/i.test(raw);
  const street = raw.replace(/,\s*españa$/i, '').trim();
  const postcode = street.match(/\b\d{5}\b/)?.[0];
  return {
    '@type': 'PostalAddress',
    streetAddress: street || undefined,
    postalCode: postcode,
    addressLocality: city || undefined,
    addressRegion: province || undefined,
    addressCountry: inSpain ? 'ES' : undefined,
  };
}

/** One entry per published time range; closed days are simply absent. */
function openingHours(schedule: ScheduleDayResponse[]): object[] {
  return schedule
    .filter(entry => SCHEMA_DAYS[entry.dayOfWeek] && entry.startTime && entry.endTime)
    .map(entry => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: SCHEMA_DAYS[entry.dayOfWeek],
      opens: entry.startTime!.slice(0, 5),
      closes: entry.endTime!.slice(0, 5),
    }));
}

function offers(services: ServiceResponse[]): object[] {
  return services
    .filter(service => service.active)
    .slice(0, MAX_OFFERS)
    .map(service => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.name,
        description: service.description?.trim() || undefined,
      },
      // No price rather than «0 €»: a 0 from the API does not say «free».
      ...(service.price > 0
        ? { price: service.price.toFixed(2), priceCurrency: 'EUR' }
        : {}),
    }));
}

/** The `LocalBusiness` block (or its most specific subtype). */
export function businessJsonLd({ business, services = [], schedule = [] }: BusinessSeoInput): object {
  const url = `${SITE_URL}${businessCanonicalPath(business)}`;
  const cover = absoluteImage(business.coverImageUrl);
  const logo = absoluteImage(business.profileImageUrl);
  const images = [cover, logo].filter((image): image is string => !!image);
  const hours = openingHours(schedule);
  const offered = offers(services);
  // WhatsApp is a way to write, not a profile of the business.
  const profiles = businessSocialLinks(business)
    .filter(link => link.network !== 'whatsapp')
    .map(link => link.url);
  const town = townOf(business);
  const hasGeo = !business.worksAtHome && business.latitude != null && business.longitude != null;

  return {
    '@context': 'https://schema.org',
    '@type': TYPE_BY_CATEGORY[primaryCategory(business)?.code ?? ''] ?? 'LocalBusiness',
    '@id': `${url}#business`,
    name: business.name,
    url,
    description: business.description?.trim() || undefined,
    image: images.length ? images : undefined,
    logo,
    telephone: business.phone?.trim() || undefined,
    address: postalAddress(business),
    geo: hasGeo
      ? { '@type': 'GeoCoordinates', latitude: business.latitude, longitude: business.longitude }
      : undefined,
    areaServed: business.worksAtHome && town ? { '@type': 'City', name: town } : undefined,
    aggregateRating: hasRating(business)
      ? {
          '@type': 'AggregateRating',
          ratingValue: Math.round(business.averageRating! * 10) / 10,
          reviewCount: business.reviewCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    makesOffer: offered.length ? offered : undefined,
    sameAs: profiles.length ? profiles : undefined,
  };
}

/** Bipsy › {business}. */
export function businessBreadcrumbJsonLd(business: BusinessResponse): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Bipsy', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: business.name,
        item: `${SITE_URL}${businessCanonicalPath(business)}`,
      },
    ],
  };
}

/** Everything the page hands to `PageMetaService.apply`. */
export function businessSeo(input: BusinessSeoInput): PageSeo {
  const { business } = input;
  return {
    fullTitle: businessTitle(business),
    description: businessDescription(business),
    path: businessCanonicalPath(business),
    image: absoluteImage(business.coverImageUrl) ?? absoluteImage(business.profileImageUrl),
    jsonLd: [businessJsonLd(input), businessBreadcrumbJsonLd(business)],
  };
}
