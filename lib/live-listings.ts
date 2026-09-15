import { normalizeEventSlug } from "@/lib/auction";
import { athleteSportLabel, displayAge, FLOOR_CENTS } from "@/lib/config";
import { loadAthleteProfileClipUrls } from "@/lib/capture-state";
import { isReadyAvatar, athleteIdsWithBodyPhotos } from "@/lib/event-create";
import { PUBLIC_BODY_SLUGS, loadBodyPhotos } from "@/lib/body-photos";
import { loadAthleteZoneRects } from "@/lib/athlete-zone-rects";
import { drawnPhotoZones } from "@/lib/zone-photos";
import { SHOW_3D_BODY } from "@/lib/feature-flags";
import { publicAthleteHandle } from "@/lib/handle";
import {
  OFFICIAL_EVENTS,
  officialRacePath,
  type OfficialEvent,
} from "@/lib/official-events";
import type { createServerSupabase } from "@/lib/supabase/server";
import { featuredSlot } from "@/lib/zones";
import { loadLeadCentsByZone } from "@/lib/zone-bids";

type Db = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

type ZoneRow = {
  id: string;
  name: string;
  status: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  social?: string | null;
  socials?: unknown;
  sport?: string | null;
  sport_detail?: string | null;
  photo_url?: string | null;
  age?: number | null;
  dob?: string | null;
};

export type LiveSlotCard = {
  id: string;
  name: string;
  date: string;
  city: string | null;
  sport: string | null;
  slug: string;
  athleteId: string;
  athleteName: string;
  handle: string | null;
  photoUrl: string | null;
  clipUrl: string | null;
  age: number | null;
  raceName: string;
  priceCents: number;
  zoneLabel: string;
};

export type LiveRaceHub = {
  key: string;
  href: string;
  name: string;
  city: string | null;
  date: string;
  sport: string | null;
  listings: LiveSlotCard[];
};

function ymd(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventDays(iso: string) {
  const days = new Set<string>();
  const sliced = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) {
    days.add(sliced);
  }
  const parsed = new Date(iso);
  if (!Number.isNaN(parsed.getTime())) {
    days.add(ymd(parsed));
    days.add(parsed.toISOString().slice(0, 10));
  }
  return days;
}

export function raceForListing(
  listing: { date: string; name: string; city: string | null },
  races: OfficialEvent[],
) {
  const days = eventDays(listing.date);
  const name = listing.name.trim().toLowerCase();
  const city = (listing.city ?? "").trim().toLowerCase();
  return (
    races.find((race) => days.has(race.starts_on)) ??
    races.find((race) => {
      const raceName = race.name.trim().toLowerCase();
      const raceCity = race.city.trim().toLowerCase();
      return name === raceName && city === raceCity;
    }) ??
    null
  );
}

export function listingsForRace(cards: LiveSlotCard[], race: OfficialEvent) {
  return cards.filter((card) => raceForListing(card, [race]));
}

export function customRaceKey(
  name: string,
  date: string,
  city: string | null,
) {
  const day = date.slice(0, 10);
  const base = normalizeEventSlug([name, city ?? ""].filter(Boolean).join(" "));
  return `c-${base || "race"}-${day}`;
}

export function groupLiveRaces(
  cards: LiveSlotCard[],
  races: OfficialEvent[] = OFFICIAL_EVENTS,
): LiveRaceHub[] {
  const hubs = new Map<string, LiveRaceHub>();
  for (const card of cards) {
    const official = raceForListing(card, races);
    const key = official
      ? `o:${official.starts_on}`
      : `c:${card.date.slice(0, 10)}:${card.raceName.trim().toLowerCase()}:${(card.city ?? "").trim().toLowerCase()}`;
    const current = hubs.get(key);
    if (current) {
      current.listings.push(card);
      continue;
    }
    const date = official?.starts_on ?? card.date;
    const name = official?.name ?? card.raceName;
    const city = official?.city ?? card.city;
    hubs.set(key, {
      key,
      href: official
        ? officialRacePath(official.starts_on)
        : `/races/${customRaceKey(name, date, city)}`,
      name,
      city,
      date,
      sport: official?.sport ?? card.sport,
      listings: [card],
    });
  }
  return [...hubs.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function findLiveRaceHub(cards: LiveSlotCard[], id: string) {
  const href = `/races/${id}`;
  return groupLiveRaces(cards).find((hub) => hub.href === href) ?? null;
}

// Display only. Bid floor and step stay in lib/money.ts.

async function loadLiveAthleteProfiles(supabase: Db, athleteIds: string[]) {
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) {
    return [] as ProfileRow[];
  }

  const selects = [
    "id, name, social, socials, sport, sport_detail, photo_url, age, dob",
    "id, name, social, socials, sport, sport_detail, age, dob",
    "id, name, social, socials, sport, sport_detail, photo_url",
    "id, name, social, socials, sport, sport_detail",
    "id, name, social, sport, sport_detail, photo_url, age, dob",
    "id, name, social, sport, sport_detail, photo_url",
    "id, name, social, sport, sport_detail",
    "id, name, social",
  ];
  for (const columns of selects) {
    const result = await supabase.from("profiles").select(columns).in("id", unique);
    if (!result.error) {
      return (result.data ?? []) as unknown as ProfileRow[];
    }
  }

  const named = await supabase
    .from("profiles")
    .select("id, name, social")
    .in("id", unique);
  if (!named.error) {
    return (named.data ?? []) as ProfileRow[];
  }

  const ids = await supabase.from("profiles").select("id, name").in("id", unique);
  if (!ids.error) {
    return (ids.data ?? []) as ProfileRow[];
  }

  return [];
}

export async function loadLiveSlotCards(supabase: Db | null) {
  if (!supabase) {
    return [] as LiveSlotCard[];
  }

  const { data } = await supabase
    .from("events")
    .select("id, name, date, city, sport, slug, athlete_id, zones(id, name, status)")
    .eq("status", "live")
    .order("date", { ascending: true });

  const rows = data ?? [];
  const athleteIds = rows.map((row) => row.athlete_id).filter(Boolean);

  const { data: avatars } = athleteIds.length
    ? await supabase
        .from("avatars")
        .select("athlete_id, ready, glb_url")
        .in("athlete_id", athleteIds)
    : { data: [] as Array<{ athlete_id: string; ready?: boolean | null; glb_url?: string | null }> };

  const glbByAthlete = new Map(
    (avatars ?? [])
      .filter((row) => isReadyAvatar(row))
      .map((row) => [row.athlete_id, row.glb_url.trim()]),
  );

  const photoReady = SHOW_3D_BODY
    ? new Set<string>()
    : await athleteIdsWithBodyPhotos(athleteIds);

  const live = rows.filter(
    (row) =>
      glbByAthlete.has(row.athlete_id) ||
      photoReady.has(row.athlete_id) ||
      PUBLIC_BODY_SLUGS.has(row.slug),
  );
  const profiles = await loadLiveAthleteProfiles(
    supabase,
    live.map((row) => row.athlete_id),
  );
  const byId = new Map(profiles.map((row) => [row.id, row]));

  const zoneRows = live.flatMap((row) => (row.zones ?? []) as ZoneRow[]);
  const leads = await loadLeadCentsByZone(
    supabase,
    zoneRows.map((zone) => zone.id),
  );
  const missingPhoto = live
    .map((row) => row.athlete_id)
    .filter((id) => !byId.get(id)?.photo_url?.trim());
  const clips = await loadAthleteProfileClipUrls(missingPhoto);
  const bodyPortraits = new Map(await Promise.all([...new Set(missingPhoto)].map(async (id) => [id, (await loadBodyPhotos(id)).front] as const)));
  const placementMaps = new Map(await Promise.all([...new Set(live.map((row) => row.athlete_id))].map(async (id) => [id, await loadAthleteZoneRects(supabase, id)] as const)));

  return live.flatMap((row) => {
    const saved = placementMaps.get(row.athlete_id);
    const placed = new Set<string>([...drawnPhotoZones("front", { saved, savedOnly: true }), ...drawnPhotoZones("back", { saved, savedOnly: true })]);
    const zones = ((row.zones ?? []) as ZoneRow[]).filter((zone) => SHOW_3D_BODY || placed.has(zone.name));
    if (!zones.some((zone) => zone.status === "open")) return [];
    const profile = byId.get(row.athlete_id);
    const sport =
      athleteSportLabel(profile?.sport, profile?.sport_detail) ??
      row.sport?.trim() ??
      null;
    const race = raceForListing(row, OFFICIAL_EVENTS);
    const slot = featuredSlot(
      zones.map((zone) => ({
        name: zone.name,
        status: zone.status,
        current_cents: leads.get(zone.id) ?? null,
      })),
    );
    const athleteName = profile?.name?.trim() || "Athlete";
    const photoUrl = profile?.photo_url?.trim() || bodyPortraits.get(row.athlete_id) || null;
    return {
      id: row.id,
      name: row.name,
      date: row.date,
      city: row.city,
      sport,
      slug: row.slug,
      athleteId: row.athlete_id,
      athleteName,
      handle: publicAthleteHandle({
        social: profile?.social,
        socials: profile?.socials,
        name: athleteName,
      }),
      photoUrl,
      clipUrl: photoUrl ? null : (clips.get(row.athlete_id) ?? null),
      age: displayAge(profile),
      raceName: race?.name ?? row.name,
      priceCents: slot.current_cents ?? FLOOR_CENTS,
      zoneLabel: slot.label,
    };
  });
}
