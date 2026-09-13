import { athleteSportLabel, FLOOR_CENTS } from "@/lib/config";
import { isReadyAvatar } from "@/lib/event-create";
import { OFFICIAL_EVENTS, type OfficialEvent } from "@/lib/official-events";
import type { createServerSupabase } from "@/lib/supabase/server";
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
  sport?: string | null;
  sport_detail?: string | null;
  photo_url?: string | null;
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
  photoUrl: string | null;
  raceName: string;
  priceCents: number;
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

// Display only. Bid floor and step stay in lib/money.ts.
function lowestOpenZoneCents(
  zones: Array<{ status: string; current_cents?: number | null }>,
) {
  const open = zones.filter((zone) => zone.status === "open");
  if (open.length === 0) {
    return FLOOR_CENTS;
  }
  return Math.min(
    ...open.map((zone) => zone.current_cents ?? FLOOR_CENTS),
  );
}

async function loadLiveAthleteProfiles(supabase: Db, athleteIds: string[]) {
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) {
    return [] as ProfileRow[];
  }

  const withPhoto = await supabase
    .from("profiles")
    .select("id, name, sport, sport_detail, photo_url")
    .in("id", unique);
  if (!withPhoto.error) {
    return (withPhoto.data ?? []) as ProfileRow[];
  }

  const withSport = await supabase
    .from("profiles")
    .select("id, name, sport, sport_detail")
    .in("id", unique);
  if (!withSport.error) {
    return (withSport.data ?? []) as ProfileRow[];
  }

  const named = await supabase.from("profiles").select("id, name").in("id", unique);
  if (!named.error) {
    return (named.data ?? []) as ProfileRow[];
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

  const live = rows.filter((row) => glbByAthlete.has(row.athlete_id));
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

  return live.map((row) => {
    const zones = (row.zones ?? []) as ZoneRow[];
    const profile = byId.get(row.athlete_id);
    const sport =
      athleteSportLabel(profile?.sport, profile?.sport_detail) ??
      row.sport?.trim() ??
      null;
    const race = raceForListing(row, OFFICIAL_EVENTS);
    return {
      id: row.id,
      name: row.name,
      date: row.date,
      city: row.city,
      sport,
      slug: row.slug,
      athleteId: row.athlete_id,
      athleteName: profile?.name?.trim() || "Athlete",
      photoUrl: profile?.photo_url?.trim() || null,
      raceName: race?.name ?? row.name,
      priceCents: lowestOpenZoneCents(
        zones.map((zone) => ({
          status: zone.status,
          current_cents: leads.get(zone.id) ?? null,
        })),
      ),
    };
  });
}
