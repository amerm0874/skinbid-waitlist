import { unstable_cache } from "next/cache";
import { COUNTRIES, isCountry } from "@/lib/countries";
import { storedOgImageUrl } from "@/lib/official-events";

export type OfficialPageFacts = {
  name: string | null;
  date: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  og_image_url: string | null;
};

const OG_REVALIDATE_SECONDS = 60 * 60;
const ISO_COUNTRY: Record<string, (typeof COUNTRIES)[number]> = {
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  DE: "Germany",
  IT: "Italy",
  FR: "France",
  ES: "Spain",
  AT: "Austria",
  BE: "Belgium",
  NL: "Netherlands",
  PT: "Portugal",
  IE: "Ireland",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czechia",
  HU: "Hungary",
  RO: "Romania",
  GR: "Greece",
  TR: "Turkey",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  AU: "Australia",
  NZ: "New Zealand",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  ZA: "South Africa",
  EG: "Egypt",
  IN: "India",
  SG: "Singapore",
  HK: "Hong Kong",
};

function metaContent(html: string, property: string) {
  const named = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  return cleanText(html.match(named)?.[1] || html.match(reversed)?.[1] || "");
}

function absoluteHttpUrl(raw: string, pageUrl: string) {
  try {
    const href = new URL(raw.replace(/&amp;/g, "&"), pageUrl).href;
    if (!/^https?:\/\//i.test(href)) {
      return null;
    }
    return href;
  } catch {
    return null;
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function cleanText(value: string | null | undefined, max = 120) {
  const text = decodeEntities(String(value ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2) {
    return null;
  }
  return text.slice(0, max);
}

function asYmd(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function asCountry(value: string | null | undefined) {
  const text = cleanText(value, 60);
  if (!text) {
    return null;
  }
  if (isCountry(text)) {
    return text;
  }
  const mapped = ISO_COUNTRY[text.toUpperCase()];
  if (mapped) {
    return mapped;
  }
  const aliases: Record<string, (typeof COUNTRIES)[number]> = {
    USA: "United States",
    "UNITED STATES OF AMERICA": "United States",
    "GREAT BRITAIN": "United Kingdom",
    "THE NETHERLANDS": "Netherlands",
  };
  return aliases[text.toUpperCase()] ?? null;
}

function typesOf(node: { ["@type"]?: unknown }) {
  const raw = node["@type"];
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return raw ? [String(raw)] : [];
}

function walkJson(node: unknown, events: Record<string, unknown>[]) {
  if (Array.isArray(node)) {
    node.forEach((item) => walkJson(item, events));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }
  const row = node as Record<string, unknown>;
  const types = typesOf(row);
  if (types.some((type) => /^(Event|SportsEvent)$/i.test(type))) {
    events.push(row);
  }
  Object.values(row).forEach((value) => walkJson(value, events));
}

function jsonLdBlocks(html: string) {
  const blocks: unknown[] = [];
  const tagged = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of tagged) {
    try {
      blocks.push(JSON.parse(match[1].replace(/[\u0000-\u001f]+/g, " ")));
    } catch {
      // Skip broken JSON-LD. Do not guess.
    }
  }
  return blocks;
}

function placeName(location: unknown): string | null {
  if (!location || typeof location !== "object") {
    return null;
  }
  const row = location as Record<string, unknown>;
  const types = typesOf(row);
  if (types.some((type) => /Place|StadiumOrArena|CivicStructure/i.test(type))) {
    return cleanText(typeof row.name === "string" ? row.name : "", 80);
  }
  if (row.address && typeof row.address === "object") {
    const address = row.address as Record<string, unknown>;
    return (
      cleanText(typeof row.name === "string" ? row.name : "", 80) ||
      cleanText(
        typeof address.streetAddress === "string" ? address.streetAddress : "",
        80,
      )
    );
  }
  return cleanText(typeof row.name === "string" ? row.name : "", 80);
}

function placeCity(location: unknown): string | null {
  if (!location || typeof location !== "object") {
    return null;
  }
  const row = location as Record<string, unknown>;
  const address =
    row.address && typeof row.address === "object"
      ? (row.address as Record<string, unknown>)
      : row;
  return cleanText(
    typeof address.addressLocality === "string" ? address.addressLocality : "",
    60,
  );
}

function placeCountry(location: unknown): string | null {
  if (!location || typeof location !== "object") {
    return null;
  }
  const row = location as Record<string, unknown>;
  const address =
    row.address && typeof row.address === "object"
      ? (row.address as Record<string, unknown>)
      : row;
  const country = address.addressCountry;
  if (typeof country === "string") {
    return asCountry(country);
  }
  if (country && typeof country === "object" && "name" in country) {
    return asCountry(String((country as { name?: unknown }).name ?? ""));
  }
  return null;
}

function isSpecificEventPage(pageUrl: string) {
  try {
    const path = new URL(pageUrl).pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) {
      return false;
    }
    if (
      parts.length === 1 &&
      /^(events|races|calendar|news)$/i.test(parts[0])
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function labeledVenue(html: string) {
  const patterns = [
    /Event Location:\s*<\/span>\s*<span[^>]*class=["'][^"']*w-post-elm-value[^"']*["'][^>]*>([^<]{3,120})/i,
    /<span[^>]*class=["'][^"']*event_map_address[^"']*["'][^>]*>[\s\S]{0,200}?w-post-elm-value[^>]*>([^<]{3,120})/i,
    /<(?:dt|th)[^>]*>\s*Venue\s*<\/(?:dt|th)>\s*<(?:dd|td)[^>]*>([^<]{3,120})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = cleanText(match?.[1], 80);
    if (value) {
      return value;
    }
  }
  return null;
}

function factsFromEvents(events: Record<string, unknown>[]) {
  const facts: OfficialPageFacts = {
    name: null,
    date: null,
    city: null,
    country: null,
    venue: null,
    og_image_url: null,
  };
  for (const event of events) {
    facts.name = facts.name || cleanText(typeof event.name === "string" ? event.name : "", 120);
    facts.date =
      facts.date ||
      asYmd(typeof event.startDate === "string" ? event.startDate : "");
    facts.venue = facts.venue || placeName(event.location);
    facts.city = facts.city || placeCity(event.location);
    facts.country = facts.country || placeCountry(event.location);
  }
  return facts;
}

function distinctVenue(
  venue: string | null,
  city: string | null,
  country: string | null,
) {
  if (!venue) {
    return null;
  }
  const folded = venue.toLowerCase();
  if (city && folded === city.toLowerCase()) {
    return null;
  }
  if (country && folded === country.toLowerCase()) {
    return null;
  }
  if (/^https?:\/\//i.test(venue)) {
    return null;
  }
  return venue;
}

function titleName(raw: string | null) {
  if (!raw) {
    return null;
  }
  const stripped = raw.split(/\s+[|\-–—]\s+/)[0]?.trim() || raw;
  return cleanText(stripped, 120);
}

// Server-only. Never run this in the browser.
export async function fetchOfficialPageFacts(
  pageUrl: string,
): Promise<OfficialPageFacts> {
  const empty: OfficialPageFacts = {
    name: null,
    date: null,
    city: null,
    country: null,
    venue: null,
    og_image_url: null,
  };
  try {
    const response = await fetch(pageUrl, {
      cache: "no-store",
      headers: {
        accept: "text/html",
        "user-agent":
          "Mozilla/5.0 (compatible; SkinBid/1.0; +https://www.skinbid.me)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return empty;
    }
    const html = (await response.text()).slice(0, 500_000);
    const events: Record<string, unknown>[] = [];
    jsonLdBlocks(html).forEach((block) => walkJson(block, events));
    const fromLd = factsFromEvents(events);
    const city = fromLd.city;
    const country = fromLd.country || asCountry(metaContent(html, "og:country-name"));
    const venue = distinctVenue(
      isSpecificEventPage(pageUrl)
        ? fromLd.venue || labeledVenue(html)
        : null,
      city,
      country,
    );
    const image =
      metaContent(html, "og:image") ||
      metaContent(html, "og:image:secure_url") ||
      metaContent(html, "twitter:image");
    return {
      name:
        fromLd.name ||
        titleName(metaContent(html, "og:title")) ||
        titleName(html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? null),
      date: fromLd.date,
      city,
      country,
      venue,
      og_image_url: storedOgImageUrl(
        image ? absoluteHttpUrl(image, pageUrl) : null,
      ),
    };
  } catch {
    return empty;
  }
}

export const cachedOfficialPageFacts = unstable_cache(
  async (pageUrl: string) => fetchOfficialPageFacts(pageUrl),
  ["official-page-facts-v1"],
  { revalidate: OG_REVALIDATE_SECONDS },
);
