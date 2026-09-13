import {
  isAthleteSport,
  isCombatSport,
  type AthleteSport,
  type CombatSport,
} from "@/lib/config";
import { isMissingColumn, isMissingRelation } from "@/lib/db-error";
import type { createServerSupabase } from "@/lib/supabase/server";
import officialOgCache from "@/lib/official-og-cache.json";

export type OfficialEvent = {
  starts_on: string;
  name: string;
  city: string;
  country: string | null;
  sport: Exclude<AthleteSport, "Other">;
  combat_subtype: CombatSport | null;
  official_url: string;
  og_image_url: string | null;
  og_image_checked_at: string | null;
  venue: string | null;
  facts_checked_at: string | null;
};

const OFFICIAL_EVENT_SELECT =
  "starts_on, name, city, country, sport, combat_subtype, official_url, og_image_url, og_image_checked_at, venue, facts_checked_at";
const OFFICIAL_EVENT_SELECT_NO_FACTS =
  "starts_on, name, city, country, sport, combat_subtype, official_url, og_image_url, og_image_checked_at";
const OFFICIAL_EVENT_SELECT_NO_OG =
  "starts_on, name, city, country, sport, combat_subtype, official_url";

type Db = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

function ymd(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function catalogDateToLocal(startsOn: string) {
  return `${startsOn}T09:00`;
}

export function formatOfficialDate(startsOn: string) {
  return parseYmd(startsOn).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatOfficialOption(row: OfficialEvent) {
  const place = [row.city, row.country].filter(Boolean).join(", ");
  const bits = [formatOfficialDate(row.starts_on), row.name, place];
  if (row.combat_subtype) {
    bits.push(row.combat_subtype);
  }
  return bits.filter(Boolean).join(" · ");
}

export function parseOfficialStartsOn(value: string | string[] | null | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const startsOn = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return null;
  }
  return startsOn;
}

export function officialEventByStartsOn(
  value: string | string[] | null | undefined,
): OfficialEvent | null {
  const startsOn = parseOfficialStartsOn(value);
  if (!startsOn) {
    return null;
  }
  return OFFICIAL_EVENTS.find((row) => row.starts_on === startsOn) ?? null;
}

export function listRacePath(startsOn: string) {
  return `/new?race=${startsOn}`;
}

export function officialRacePath(startsOn: string) {
  return `/races/${startsOn}`;
}

export function sportPosterKey(sport: string) {
  return sport.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function sportFallbackPhoto(sport: string) {
  return `/sports/${sportPosterKey(sport)}.jpg`;
}

function isSportFallbackPath(value: string) {
  return (
    value.startsWith("/sports/") ||
    /(?:^|\/)sports\/[a-z0-9]+\.jpe?g(?:\?|$)/i.test(value)
  );
}

export function storedOgImageUrl(photoUrl?: string | null) {
  const value = photoUrl?.trim() ?? "";
  if (!value || isSportFallbackPath(value)) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function raceCardPhoto(sport: string, photoUrl?: string | null) {
  return storedOgImageUrl(photoUrl) ?? sportFallbackPhoto(sport);
}

const SAVED_OG_IMAGES = new Map<string, string>(
  Object.entries(officialOgCache).flatMap(([startsOn, photoUrl]) => {
    const url = storedOgImageUrl(photoUrl);
    return url ? [[startsOn, url] as const] : [];
  }),
);

export function rememberSavedOgImage(startsOn: string, photoUrl?: string | null) {
  const url = storedOgImageUrl(photoUrl);
  if (!url) {
    return;
  }
  SAVED_OG_IMAGES.set(startsOn, url);
}

export function withRememberedOgImages(rows: OfficialEvent[]): OfficialEvent[] {
  return rows.map((row) => {
    const photo =
      storedOgImageUrl(row.og_image_url) ??
      SAVED_OG_IMAGES.get(row.starts_on) ??
      null;
    if (photo === row.og_image_url) {
      return row;
    }
    return { ...row, og_image_url: photo };
  });
}

export function allUpcomingOfficialEvents(now = new Date()): OfficialEvent[] {
  const today = ymd(now);
  return OFFICIAL_EVENTS.filter((row) => row.starts_on >= today).sort((left, right) =>
    left.starts_on.localeCompare(right.starts_on),
  );
}

export function upcomingOfficialEvents(
  sport: string | null | undefined,
  now = new Date(),
): OfficialEvent[] {
  if (!isAthleteSport(sport) || sport === "Other") {
    return [];
  }
  return allUpcomingOfficialEvents(now).filter((row) => row.sport === sport);
}

function isDroppedCatalogRow(startsOn: string, name: string, url: string) {
  if (startsOn.startsWith("2027")) {
    return true;
  }
  if (/canelo/i.test(name)) {
    return true;
  }
  return isUfcCatalogRow(name, url);
}

function isUfcCatalogRow(name: string, url: string) {
  const title = name.trim();
  const href = url.trim().toLowerCase();
  return (
    /^ufc(\s|$|:)/i.test(title) ||
    href.includes("ufc.com") ||
    href.includes("/ufc/")
  );
}

function asOfficialEvent(row: {
  starts_on?: string | null;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  sport?: string | null;
  combat_subtype?: string | null;
  official_url?: string | null;
  og_image_url?: string | null;
  og_image_checked_at?: string | null;
  venue?: string | null;
  facts_checked_at?: string | null;
}): OfficialEvent | null {
  const startsOn = (row.starts_on ?? "").trim().slice(0, 10);
  const name = row.name?.trim() ?? "";
  const city = row.city?.trim() ?? "";
  const country = row.country?.trim() || null;
  const sport = row.sport?.trim() ?? "";
  const url = row.official_url?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !name || !url) {
    return null;
  }
  if (isDroppedCatalogRow(startsOn, name, url)) {
    return null;
  }
  if (
    sport !== "HYROX" &&
    sport !== "Running" &&
    sport !== "CrossFit" &&
    sport !== "Combat" &&
    sport !== "Athletics"
  ) {
    return null;
  }
  const ogImageUrl = storedOgImageUrl(row.og_image_url);
  const checked = row.og_image_checked_at?.trim() || null;
  const venue = row.venue?.trim() || null;
  const factsChecked = row.facts_checked_at?.trim() || null;
  const subtype = row.combat_subtype?.trim() || null;
  if (sport === "Combat") {
    if (!isCombatSport(subtype)) {
      return null;
    }
    return {
      starts_on: startsOn,
      name,
      city,
      country,
      sport,
      combat_subtype: subtype,
      official_url: url,
      og_image_url: ogImageUrl,
      og_image_checked_at: checked,
      venue,
      facts_checked_at: factsChecked,
    };
  }
  return {
    starts_on: startsOn,
    name,
    city,
    country,
    sport,
    combat_subtype: null,
    official_url: url,
    og_image_url: ogImageUrl,
    og_image_checked_at: checked,
    venue,
    facts_checked_at: factsChecked,
  };
}

async function queryOfficialEvents(
  supabase: Db,
  columns: string,
  now: Date,
  sport?: string,
) {
  let query = supabase
    .from("official_events")
    .select(columns)
    .gte("starts_on", ymd(now))
    .lt("starts_on", "2027-01-01")
    .order("starts_on", { ascending: true });
  if (sport) {
    query = query.eq("sport", sport);
  }
  return query;
}

async function queryUpcomingOfficialEvents(
  supabase: Db,
  now: Date,
  sport?: string,
) {
  let result = await queryOfficialEvents(
    supabase,
    OFFICIAL_EVENT_SELECT,
    now,
    sport,
  );
  if (!result.error) {
    return result;
  }
  if (
    isMissingColumn(result.error, "venue") ||
    isMissingColumn(result.error, "facts_checked_at")
  ) {
    result = await queryOfficialEvents(
      supabase,
      OFFICIAL_EVENT_SELECT_NO_FACTS,
      now,
      sport,
    );
    if (!result.error) {
      return result;
    }
  }
  if (
    isMissingColumn(result.error, "og_image_url") ||
    isMissingColumn(result.error, "og_image_checked_at")
  ) {
    return queryOfficialEvents(
      supabase,
      OFFICIAL_EVENT_SELECT_NO_OG,
      now,
      sport,
    );
  }
  return result;
}

async function queryOfficialEventByStartsOn(supabase: Db, startsOn: string) {
  let result = await supabase
    .from("official_events")
    .select(OFFICIAL_EVENT_SELECT)
    .eq("starts_on", startsOn)
    .maybeSingle();
  if (!result.error) {
    return result;
  }
  if (
    isMissingColumn(result.error, "venue") ||
    isMissingColumn(result.error, "facts_checked_at")
  ) {
    result = await supabase
      .from("official_events")
      .select(OFFICIAL_EVENT_SELECT_NO_FACTS)
      .eq("starts_on", startsOn)
      .maybeSingle();
    if (!result.error) {
      return result;
    }
  }
  if (
    isMissingColumn(result.error, "og_image_url") ||
    isMissingColumn(result.error, "og_image_checked_at")
  ) {
    return supabase
      .from("official_events")
      .select(OFFICIAL_EVENT_SELECT_NO_OG)
      .eq("starts_on", startsOn)
      .maybeSingle();
  }
  return result;
}

function rowsOrFallback(
  data: unknown[] | null,
  fallback: OfficialEvent[],
) {
  const rows = (data ?? [])
    .map((row) => asOfficialEvent(row as Parameters<typeof asOfficialEvent>[0]))
    .filter((row): row is OfficialEvent => Boolean(row));
  return rows.length > 0 ? rows : fallback;
}

// Prefer the seeded table. Fall back to the in-repo list if schema is not applied yet.
export async function loadUpcomingOfficialEvents(
  supabase: Db | null,
  sport: string | null | undefined,
  now = new Date(),
): Promise<OfficialEvent[]> {
  const fallback = upcomingOfficialEvents(sport, now);
  if (!supabase || !isAthleteSport(sport) || sport === "Other") {
    return withRememberedOgImages(fallback);
  }
  const { data, error } = await queryUpcomingOfficialEvents(supabase, now, sport);
  if (error) {
    if (!isMissingRelation(error, "official_events")) {
      console.log("Official events load failed", error.message);
    }
    return withRememberedOgImages(fallback);
  }
  return withRememberedOgImages(rowsOrFallback(data, fallback));
}

export async function loadAllUpcomingOfficialEvents(
  supabase: Db | null,
  now = new Date(),
): Promise<OfficialEvent[]> {
  const fallback = allUpcomingOfficialEvents(now);
  if (!supabase) {
    return withRememberedOgImages(fallback);
  }
  const { data, error } = await queryUpcomingOfficialEvents(supabase, now);
  if (error) {
    if (!isMissingRelation(error, "official_events")) {
      console.log("Official events load failed", error.message);
    }
    return withRememberedOgImages(fallback);
  }
  return withRememberedOgImages(rowsOrFallback(data, fallback));
}

export async function loadOfficialEventByStartsOn(
  supabase: Db | null,
  value: string | string[] | null | undefined,
): Promise<OfficialEvent | null> {
  const startsOn = parseOfficialStartsOn(value);
  if (!startsOn) {
    return null;
  }
  const fallback = officialEventByStartsOn(startsOn);
  if (!supabase) {
    return withRememberedOgImages(fallback ? [fallback] : [])[0] ?? null;
  }
  const { data, error } = await queryOfficialEventByStartsOn(supabase, startsOn);
  if (error) {
    if (!isMissingRelation(error, "official_events")) {
      console.log("Official event load failed", error.message);
    }
    return withRememberedOgImages(fallback ? [fallback] : [])[0] ?? null;
  }
  const row =
    asOfficialEvent((data ?? {}) as Parameters<typeof asOfficialEvent>[0]) ??
    fallback;
  return withRememberedOgImages(row ? [row] : [])[0] ?? null;
}

// 20 researched rows through 2026. Combat keeps IBJJF. Dates are unique across the catalog.
type CatalogSeed = Omit<
  OfficialEvent,
  "og_image_url" | "og_image_checked_at" | "venue" | "facts_checked_at"
>;

const OFFICIAL_EVENT_ROWS: CatalogSeed[] = [
  {
    starts_on: "2026-09-23",
    name: "HYROX Rome",
    city: "Rome",
    country: "Italy",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-rome/",
  },
  {
    starts_on: "2026-09-30",
    name: "INTERSPORT HYROX Bordeaux",
    city: "Bordeaux",
    country: "France",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-bordeaux-s26-27/",
  },
  {
    starts_on: "2026-10-01",
    name: "HYROX Karlsruhe",
    city: "Karlsruhe",
    country: "Germany",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-karlsruhe/",
  },
  {
    starts_on: "2026-10-08",
    name: "HWPO HYROX Boston",
    city: "Boston",
    country: "United States",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hwpo-hyrox-boston-26-27/",
  },
  {
    starts_on: "2026-10-22",
    name: "MyFitnessPal HYROX Tampa",
    city: "Tampa",
    country: "United States",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-tampa/",
  },
  {
    starts_on: "2026-10-27",
    name: "HYROX Birmingham",
    city: "Birmingham",
    country: "United Kingdom",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-birmingham/",
  },
  {
    starts_on: "2026-10-28",
    name: "INTERSPORT HYROX Hamburg",
    city: "Hamburg",
    country: "Germany",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/intersport-hyrox-hamburg/",
  },
  {
    starts_on: "2026-11-11",
    name: "EDEKA HYROX Düsseldorf",
    city: "Düsseldorf",
    country: "Germany",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/event/hyrox-dusseldorf/",
  },
  {
    starts_on: "2026-11-18",
    name: "HYROX Dallas",
    city: "Dallas",
    country: "United States",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://usa.hyrox.com/events/hyrox-dallas-season-26-27-b0k8ev",
  },
  {
    starts_on: "2026-12-02",
    name: "HYROX London ExCel",
    city: "London",
    country: "United Kingdom",
    sport: "HYROX",
    combat_subtype: null,
    official_url: "https://hyrox.com/find-my-race/",
  },
  {
    starts_on: "2026-09-27",
    name: "BMW Berlin Marathon",
    city: "Berlin",
    country: "Germany",
    sport: "Running",
    combat_subtype: null,
    official_url: "https://www.bmw-berlin-marathon.com/",
  },
  {
    starts_on: "2026-10-11",
    name: "Bank of America Chicago Marathon",
    city: "Chicago",
    country: "United States",
    sport: "Running",
    combat_subtype: null,
    official_url: "https://www.chicagomarathon.com/",
  },
  {
    starts_on: "2026-10-25",
    name: "Valencia Half Marathon Trinidad Alfonso Zurich",
    city: "Valencia",
    country: "Spain",
    sport: "Running",
    combat_subtype: null,
    official_url: "https://www.valenciaciudaddelrunning.com/",
  },
  {
    starts_on: "2026-11-01",
    name: "TCS New York City Marathon",
    city: "New York",
    country: "United States",
    sport: "Running",
    combat_subtype: null,
    official_url: "https://www.tcsnycmarathon.org/",
  },
  {
    starts_on: "2026-12-06",
    name: "Valencia Marathon Trinidad Alfonso Zurich",
    city: "Valencia",
    country: "Spain",
    sport: "Running",
    combat_subtype: null,
    official_url:
      "https://www.valenciaciudaddelrunning.com/evento/maraton-valencia-2026/",
  },
  {
    starts_on: "2026-09-25",
    name: "Gymreapers Wodapalooza SoCal",
    city: "Huntington Beach",
    country: "United States",
    sport: "CrossFit",
    combat_subtype: null,
    official_url: "https://wodapalooza.com/",
  },
  {
    starts_on: "2026-10-23",
    name: "Rogue Invitational 2026",
    city: "Aberdeen",
    country: "United Kingdom",
    sport: "CrossFit",
    combat_subtype: null,
    official_url: "https://www.roguefitness.com/invitational",
  },
  {
    starts_on: "2026-11-05",
    name: "Wodapalooza Online Challenge & Qualifier",
    city: "Online",
    country: null,
    sport: "CrossFit",
    combat_subtype: null,
    official_url: "https://wodapalooza.com/",
  },
  {
    starts_on: "2026-12-10",
    name: "World IBJJF Jiu-Jitsu No-Gi Championship 2026",
    city: "Las Vegas",
    country: "United States",
    sport: "Combat",
    combat_subtype: "BJJ",
    official_url:
      "https://ibjjf.com/events/world-ibjjf-jiu-jitsu-no-gi-championship-2026",
  },
  {
    starts_on: "2026-10-02",
    name: "Athlos NYC",
    city: "New York",
    country: "United States",
    sport: "Athletics",
    combat_subtype: null,
    official_url:
      "https://worldathletics.org/competitions/world-athletics-continental-tour/calendar-results",
  },
];

export const OFFICIAL_EVENTS: OfficialEvent[] = OFFICIAL_EVENT_ROWS.map((row) => ({
  ...row,
  og_image_url: null,
  og_image_checked_at: null,
  venue: null,
  facts_checked_at: null,
}));
