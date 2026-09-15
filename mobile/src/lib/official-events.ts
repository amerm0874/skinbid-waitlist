// Ported from the web app's lib/official-events.ts: the in-repo seed catalog
// of real-world races, plus the pure helpers used to render/filter it. The
// web app also merges in a `official_events` Supabase table when present —
// see lib/queries.ts loadOfficialEvents, which queries that table directly
// and falls back to this list.

import { isAthleteSport, isCombatSport, type AthleteSport, type CombatSport } from "@/lib/config";

export type OfficialEvent = {
  starts_on: string;
  name: string;
  city: string;
  country: string | null;
  sport: Exclude<AthleteSport, "Other">;
  combat_subtype: CombatSport | null;
  official_url: string;
  og_image_url: string | null;
  venue: string | null;
};

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

export function formatOfficialDate(startsOn: string) {
  return parseYmd(startsOn).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function officialEventByStartsOn(startsOn: string): OfficialEvent | null {
  return OFFICIAL_EVENTS.find((row) => row.starts_on === startsOn) ?? null;
}

export function allUpcomingOfficialEvents(now = new Date()): OfficialEvent[] {
  const today = ymd(now);
  return OFFICIAL_EVENTS.filter((row) => row.starts_on >= today).sort((a, b) =>
    a.starts_on.localeCompare(b.starts_on),
  );
}

export function upcomingOfficialEvents(sport: string | null | undefined, now = new Date()): OfficialEvent[] {
  if (!isAthleteSport(sport) || sport === "Other") return [];
  return allUpcomingOfficialEvents(now).filter((row) => row.sport === sport);
}

type CatalogSeed = Omit<OfficialEvent, "og_image_url" | "venue">;

const OFFICIAL_EVENT_ROWS: CatalogSeed[] = [
  { starts_on: "2026-09-23", name: "HYROX Rome", city: "Rome", country: "Italy", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-rome/" },
  { starts_on: "2026-09-30", name: "INTERSPORT HYROX Bordeaux", city: "Bordeaux", country: "France", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-bordeaux-s26-27/" },
  { starts_on: "2026-10-01", name: "HYROX Karlsruhe", city: "Karlsruhe", country: "Germany", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-karlsruhe/" },
  { starts_on: "2026-10-08", name: "HWPO HYROX Boston", city: "Boston", country: "United States", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hwpo-hyrox-boston-26-27/" },
  { starts_on: "2026-10-22", name: "MyFitnessPal HYROX Tampa", city: "Tampa", country: "United States", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-tampa/" },
  { starts_on: "2026-10-27", name: "HYROX Birmingham", city: "Birmingham", country: "United Kingdom", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-birmingham/" },
  { starts_on: "2026-10-28", name: "INTERSPORT HYROX Hamburg", city: "Hamburg", country: "Germany", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/intersport-hyrox-hamburg/" },
  { starts_on: "2026-11-11", name: "EDEKA HYROX Düsseldorf", city: "Düsseldorf", country: "Germany", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/event/hyrox-dusseldorf/" },
  { starts_on: "2026-11-18", name: "HYROX Dallas", city: "Dallas", country: "United States", sport: "HYROX", combat_subtype: null, official_url: "https://usa.hyrox.com/events/hyrox-dallas-season-26-27-b0k8ev" },
  { starts_on: "2026-12-02", name: "HYROX London ExCel", city: "London", country: "United Kingdom", sport: "HYROX", combat_subtype: null, official_url: "https://hyrox.com/find-my-race/" },
  { starts_on: "2026-09-27", name: "BMW Berlin Marathon", city: "Berlin", country: "Germany", sport: "Running", combat_subtype: null, official_url: "https://www.bmw-berlin-marathon.com/" },
  { starts_on: "2026-10-11", name: "Bank of America Chicago Marathon", city: "Chicago", country: "United States", sport: "Running", combat_subtype: null, official_url: "https://www.chicagomarathon.com/" },
  { starts_on: "2026-10-25", name: "Valencia Half Marathon Trinidad Alfonso Zurich", city: "Valencia", country: "Spain", sport: "Running", combat_subtype: null, official_url: "https://www.valenciaciudaddelrunning.com/" },
  { starts_on: "2026-11-01", name: "TCS New York City Marathon", city: "New York", country: "United States", sport: "Running", combat_subtype: null, official_url: "https://www.tcsnycmarathon.org/" },
  { starts_on: "2026-12-06", name: "Valencia Marathon Trinidad Alfonso Zurich", city: "Valencia", country: "Spain", sport: "Running", combat_subtype: null, official_url: "https://www.valenciaciudaddelrunning.com/evento/maraton-valencia-2026/" },
  { starts_on: "2026-09-25", name: "Gymreapers Wodapalooza SoCal", city: "Huntington Beach", country: "United States", sport: "CrossFit", combat_subtype: null, official_url: "https://wodapalooza.com/" },
  { starts_on: "2026-10-23", name: "Rogue Invitational 2026", city: "Aberdeen", country: "United Kingdom", sport: "CrossFit", combat_subtype: null, official_url: "https://www.roguefitness.com/invitational" },
  { starts_on: "2026-11-05", name: "Wodapalooza Online Challenge & Qualifier", city: "Online", country: null, sport: "CrossFit", combat_subtype: null, official_url: "https://wodapalooza.com/" },
  { starts_on: "2026-12-10", name: "World IBJJF Jiu-Jitsu No-Gi Championship 2026", city: "Las Vegas", country: "United States", sport: "Combat", combat_subtype: "BJJ", official_url: "https://ibjjf.com/events/world-ibjjf-jiu-jitsu-no-gi-championship-2026" },
  { starts_on: "2026-10-02", name: "Athlos NYC", city: "New York", country: "United States", sport: "Athletics", combat_subtype: null, official_url: "https://worldathletics.org/competitions/world-athletics-continental-tour/calendar-results" },
];

export const OFFICIAL_EVENTS: OfficialEvent[] = OFFICIAL_EVENT_ROWS.map((row) => ({
  ...row,
  og_image_url: null,
  venue: null,
}));

export function raceForListing(listing: { date: string; name: string; city: string | null }, races: OfficialEvent[]) {
  const day = listing.date.slice(0, 10);
  const name = listing.name.trim().toLowerCase();
  const city = (listing.city ?? "").trim().toLowerCase();
  return (
    races.find((race) => race.starts_on === day) ??
    races.find((race) => race.name.trim().toLowerCase() === name && race.city.trim().toLowerCase() === city) ??
    null
  );
}
