import { cache } from "react";
import { FLOOR_CENTS, isAthleteSport } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { isReadyAvatar } from "@/lib/event-create";
import { publicAthleteHandle } from "@/lib/handle";
import { raceForListing } from "@/lib/live-listings";
import {
  OFFICIAL_EVENTS,
  officialRacePath,
} from "@/lib/official-events";
import { createPublicSupabase } from "@/lib/supabase/admin";
import {
  isPublishedEventStatus,
  PUBLISHED_EVENT_STATUSES,
} from "@/lib/types";
import { loadLeadCentsByZone } from "@/lib/zone-bids";
import { featuredSlot } from "@/lib/zones";

// Drafts and cancelled stay private. Sitemap and public pages only see these.
const PUBLISHED_STATUSES = PUBLISHED_EVENT_STATUSES;

type ZoneStatusRow = { id?: string; name?: string; status: string };

export type PublicAthleteRace = {
  starts_on: string;
  name: string;
  city: string;
  sport: string;
  og_image_url: string | null;
  href: string;
};

export type PublicAthlete = {
  id: string;
  name: string;
  country: string | null;
  social: string | null;
  socials: unknown;
  handle: string;
  sport: string | null;
  sportDetail: string | null;
  photoUrl: string | null;
  glbUrl: string | null;
  race: PublicAthleteRace | null;
  liveEvent: {
    name: string;
    date: string;
    slug: string;
    city: string | null;
    sport: string | null;
    openCount: number;
    slotLabel: string;
    slotCents: number;
  } | null;
};

export type PublicEventSeo = {
  slug: string;
  athleteName: string;
  eventName: string;
  date: string;
  city: string | null;
  openCount: number;
  isDemo: boolean;
};

// Anon client only. A logged-in cookie would let an athlete see their own drafts.
function publicDb() {
  return createPublicSupabase();
}

function openCountFrom(zones: ZoneStatusRow[] | null | undefined) {
  return (zones ?? []).filter((zone) => zone.status === "open").length;
}

async function loadReadyAvatar(
  db: NonNullable<ReturnType<typeof publicDb>>,
  athleteId: string,
) {
  const { data } = await db
    .from("avatars")
    .select("ready, glb_url")
    .eq("athlete_id", athleteId)
    .maybeSingle();
  return isReadyAvatar(data) ? data : null;
}

async function athleteHasReadyGlb(
  db: NonNullable<ReturnType<typeof publicDb>>,
  athleteId: string,
) {
  return Boolean(await loadReadyAvatar(db, athleteId));
}

async function loadAthleteRace(
  db: NonNullable<ReturnType<typeof publicDb>>,
  event: { name: string; date: string; slug: string; city: string | null; sport: string | null },
): Promise<PublicAthleteRace> {
  const matched = raceForListing(event, OFFICIAL_EVENTS);
  if (matched) {
    const { data } = await db
      .from("official_events")
      .select("og_image_url")
      .eq("starts_on", matched.starts_on)
      .maybeSingle();
    return {
      starts_on: matched.starts_on,
      name: matched.name,
      city: matched.city,
      sport: matched.sport,
      og_image_url: data?.og_image_url ?? matched.og_image_url,
      href: officialRacePath(matched.starts_on),
    };
  }
  const startsOn = event.date.slice(0, 10);
  const sport = isAthleteSport(event.sport) ? event.sport : "Running";
  return {
    starts_on: /^\d{4}-\d{2}-\d{2}$/.test(startsOn) ? startsOn : event.date,
    name: event.name,
    city: event.city ?? "",
    sport,
    og_image_url: null,
    href: `/e/${event.slug}`,
  };
}

const ATHLETE_PROFILE_SELECT =
  "id, name, country, social, socials, sport, sport_detail, photo_url";
const ATHLETE_PROFILE_SELECT_NO_PHOTO =
  "id, name, country, social, socials, sport, sport_detail";
const ATHLETE_PROFILE_SELECT_BASIC = "id, name, country, social";

type AthleteProfileRow = {
  id: string;
  name: string | null;
  country: string | null;
  social: string | null;
  socials?: unknown;
  sport?: string | null;
  sport_detail?: string | null;
  photo_url?: string | null;
};

async function loadAthleteRows(
  db: NonNullable<ReturnType<typeof publicDb>>,
): Promise<AthleteProfileRow[]> {
  const selects = [
    ATHLETE_PROFILE_SELECT,
    ATHLETE_PROFILE_SELECT_NO_PHOTO,
    ATHLETE_PROFILE_SELECT_BASIC,
  ];
  for (const columns of selects) {
    const result = await db
      .from("profiles")
      .select(columns)
      .eq("role", "athlete");
    if (!result.error) {
      return (result.data ?? []) as unknown as AthleteProfileRow[];
    }
  }
  return [];
}

async function readyAthleteIds(
  db: NonNullable<ReturnType<typeof publicDb>>,
  athleteIds: string[],
) {
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Set<string>();
  }
  const { data } = await db
    .from("avatars")
    .select("athlete_id, ready, glb_url")
    .in("athlete_id", unique);
  return new Set(
    (data ?? [])
      .filter((row) => isReadyAvatar(row))
      .map((row) => row.athlete_id),
  );
}

export const loadAthleteByHandle = cache(async (rawHandle: string) => {
  const handle = rawHandle.trim().toLowerCase();
  if (!handle) {
    return null;
  }

  const db = publicDb();
  if (!db) {
    return null;
  }

  const rows = await loadAthleteRows(db);
  const profile = rows.find((row) => publicAthleteHandle(row) === handle);
  if (!profile) {
    return null;
  }

  const avatar = await loadReadyAvatar(db, profile.id);
  const { data: events } = await db
    .from("events")
    .select("name, date, slug, city, sport, status, zones(id, name, status)")
    .eq("athlete_id", profile.id)
    .in("status", [...PUBLISHED_STATUSES])
    .order("date", { ascending: false });

  // No real scan → treat as no live listing on the public page.
  const published = avatar ? (events ?? []) : [];
  const live = published.find((event) => event.status === "live") ?? null;
  const liveZones = (live?.zones ?? []) as ZoneStatusRow[];
  const leads = live
    ? await loadLeadCentsByZone(
        db,
        liveZones.map((zone) => zone.id ?? "").filter(Boolean),
      )
    : new Map<string, number>();
  const slot = featuredSlot(
    liveZones.map((zone) => ({
      name: zone.name ?? "",
      status: zone.status,
      current_cents: zone.id ? (leads.get(zone.id) ?? null) : null,
    })),
  );
  const profileSport = profile.sport?.trim() || null;
  const sport = profileSport || live?.sport || published[0]?.sport || null;

  const athlete: PublicAthlete = {
    id: profile.id,
    name: profile.name?.trim() || "Athlete",
    country: profile.country,
    social: profile.social,
    socials: profile.socials ?? null,
    handle,
    sport,
    sportDetail: profile.sport_detail?.trim() || null,
    photoUrl: profile.photo_url?.trim() || null,
    glbUrl: avatar?.glb_url ?? null,
    race: live ? await loadAthleteRace(db, live) : null,
    liveEvent: live
      ? {
          name: live.name,
          date: live.date,
          slug: live.slug,
          city: live.city ?? null,
          sport: live.sport,
          openCount: openCountFrom(liveZones),
          slotLabel: slot.label,
          slotCents: slot.current_cents ?? FLOOR_CENTS,
        }
      : null,
  };
  return athlete;
});

export async function listPublishedAthleteHandles() {
  const db = publicDb();
  if (!db) {
    return [] as string[];
  }
  const { data } = await db
    .from("profiles")
    .select("name, social")
    .eq("role", "athlete");

  const seen = new Set<string>();
  const handles: string[] = [];
  for (const row of data ?? []) {
    const handle = publicAthleteHandle(row);
    if (!handle || seen.has(handle)) {
      continue;
    }
    seen.add(handle);
    handles.push(handle);
  }
  return handles;
}

export async function listPublishedEventSlugs() {
  const db = publicDb();
  if (!db) {
    return [] as Array<{ slug: string; date: string }>;
  }
  const { data } = await db
    .from("events")
    .select("slug, date, status, athlete_id")
    .in("status", [...PUBLISHED_STATUSES]);

  const rows = (data ?? []).filter(
    (row) => row.slug !== DEMO_SLUG && isPublishedEventStatus(row.status),
  );
  const ready = await readyAthleteIds(
    db,
    rows.map((row) => row.athlete_id),
  );

  return rows
    .filter((row) => ready.has(row.athlete_id))
    .map((row) => ({ slug: row.slug, date: row.date }));
}

export const loadEventSeo = cache(async (slug: string): Promise<PublicEventSeo | null> => {
  const db = publicDb();
  if (db) {
    const { data: event } = await db
      .from("events")
      .select("name, date, city, slug, athlete_id, status, zones(status)")
      .eq("slug", slug)
      .maybeSingle();

    if (
      event &&
      isPublishedEventStatus(event.status) &&
      event.slug !== DEMO_SLUG &&
      (await athleteHasReadyGlb(db, event.athlete_id))
    ) {
      const { data: athlete } = await db
        .from("profiles")
        .select("name")
        .eq("id", event.athlete_id)
        .maybeSingle();
      return {
        slug: event.slug,
        athleteName: athlete?.name?.trim() || "Athlete",
        eventName: event.name,
        date: event.date,
        city: event.city,
        openCount: openCountFrom(event.zones as ZoneStatusRow[]),
        isDemo: false,
      };
    }
  }

  return null;
});
