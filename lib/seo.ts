import type { Metadata } from "next";
import { FLOOR_CENTS, SITE } from "@/lib/config";

export function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function openZoneLabel(count: number) {
  return count === 1 ? "1 zone open" : `${count} zones open`;
}

export function athletePageTitle(name: string) {
  return `${name} — event-day body slots | ${SITE.name}`;
}

export function eventPageTitle(name: string, eventName: string, dateIso: string) {
  return `${name} · ${eventName} · ${formatEventDate(dateIso)} | ${SITE.name}`;
}

export const EVENTS_INDEX_TITLE = `Live body-slot events | ${SITE.name}`;

export function racePageTitle(name: string, dateLabel: string) {
  return `${name} · ${dateLabel} | ${SITE.name}`;
}

export function racePageDescription(input: {
  name: string;
  city: string;
  country: string | null;
  sport: string;
}) {
  const place = [input.city, input.country].filter(Boolean).join(", ");
  return `${input.name} in ${place}. ${input.sport}. Official race page on SkinBid.`;
}

export function athletePageDescription(input: {
  name: string;
  eventName: string | null;
  dateIso: string | null;
}) {
  if (input.eventName && input.dateIso) {
    return `${input.name} lists ${input.eventName} on ${formatEventDate(input.dateIso)}. Brands bid on body zones.`;
  }
  return `${input.name} lists event-day body slots on SkinBid. Brands bid on body zones.`;
}

export function eventPageDescription(name: string, eventName: string, dateIso: string) {
  return `${name} lists ${eventName} on ${formatEventDate(dateIso)}. Brands bid on body zones.`;
}

export const EVENTS_INDEX_DESCRIPTION =
  "Live events where brands bid on body zones for one-day temp marks.";

export function shareMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: `${SITE.url}${path}`,
      siteName: SITE.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

// Private product screens must not emit OG title/description.
export const NO_OG_METADATA: Metadata = {
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export function personJsonLd(input: {
  name: string;
  handle: string;
  sameAs: string | null;
  country: string | null;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    url: `${SITE.url}/a/${input.handle}`,
  };
  if (input.sameAs) {
    data.sameAs = input.sameAs;
  }
  if (input.country?.trim()) {
    data.nationality = input.country.trim();
  }
  return data;
}

// Public athlete page: Person always. Event + Offer when they have a live listing.
export function athletePageJsonLd(input: {
  name: string;
  handle: string;
  sameAs: string | null;
  country: string | null;
  liveEvent: {
    name: string;
    dateIso: string;
    slug: string;
    city: string | null;
    openCount: number;
  } | null;
}) {
  const person = personJsonLd({
    name: input.name,
    handle: input.handle,
    sameAs: input.sameAs,
    country: input.country,
  });
  if (!input.liveEvent) {
    return person;
  }

  const { "@context": _context, ...personNode } = person;
  const eventBundle = eventOfferJsonLd({
    athleteName: input.name,
    eventName: input.liveEvent.name,
    dateIso: input.liveEvent.dateIso,
    slug: input.liveEvent.slug,
    city: input.liveEvent.city,
    openCount: input.liveEvent.openCount,
  });
  const graph = (eventBundle["@graph"] as unknown[]) ?? [];
  return {
    "@context": "https://schema.org",
    "@graph": [personNode, ...graph],
  };
}

export function eventOfferJsonLd(input: {
  athleteName: string;
  eventName: string;
  dateIso: string;
  slug: string;
  city: string | null;
  openCount: number;
}) {
  const availability =
    input.openCount > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/SoldOut";
  const eventUrl = `${SITE.url}/e/${input.slug}`;
  const event: Record<string, unknown> = {
    "@type": "Event",
    name: input.eventName,
    startDate: input.dateIso,
    url: eventUrl,
    organizer: {
      "@type": "Person",
      name: input.athleteName,
    },
    offers: {
      "@type": "Offer",
      url: eventUrl,
      priceCurrency: "USD",
      price: String(FLOOR_CENTS / 100),
      availability,
    },
  };
  if (input.city) {
    event.location = {
      "@type": "Place",
      name: input.city,
      address: input.city,
    };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [
      event,
      {
        "@type": "Offer",
        url: eventUrl,
        priceCurrency: "USD",
        price: String(FLOOR_CENTS / 100),
        availability,
      },
    ],
  };
}
