// Data access layer: direct Supabase reads/writes, ported from the web app's
// lib/live-listings.ts, lib/public-listings.ts, lib/zone-bids.ts,
// lib/official-events.ts and lib/notifications.ts. Everything here goes
// through the same RLS policies as the web app's anon/authenticated client —
// there is no service-role key on this client, so anything that requires it
// (Whop checkout creation, admin proof approval, transactional email) is not
// implemented here. See src/lib/webActions.ts for those.

import { supabase } from "@/lib/supabase";
import { athleteSportLabel, FLOOR_CENTS, isAthleteSport } from "@/lib/config";
import { isReadyAvatar } from "@/lib/avatars";
import {
  OFFICIAL_EVENTS,
  allUpcomingOfficialEvents,
  raceForListing,
  upcomingOfficialEvents,
  type OfficialEvent,
} from "@/lib/official-events";
import { PUBLISHED_EVENT_STATUSES, isPublishedEventStatus, type BidStatus, type NoticeRow, type Profile } from "@/lib/types";
import { featuredSlot } from "@/lib/zones";
import { publicAthleteHandle } from "@/lib/handle";
import { isMarkKind, type MarkKind } from "@/lib/logo";

// ---------- profiles ----------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.log("fetchProfile failed", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

export async function upsertProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch });
  if (error) throw new Error(error.message);
}

// ---------- live listings (browse) ----------

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
  zoneLabel: string;
};

async function loadLeadCentsByZone(zoneIds: string[]) {
  const unique = [...new Set(zoneIds.filter(Boolean))];
  const leads = new Map<string, number>();
  if (!unique.length) return leads;
  const { data } = await supabase
    .from("bids")
    .select("zone_id, amount_cents, status")
    .in("zone_id", unique)
    .in("status", ["held", "won"]);
  for (const bid of data ?? []) {
    const current = leads.get(bid.zone_id) ?? 0;
    if (bid.amount_cents > current) leads.set(bid.zone_id, bid.amount_cents);
  }
  return leads;
}

export async function fetchLiveSlotCards(): Promise<LiveSlotCard[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, name, date, city, sport, slug, athlete_id, zones(id, name, status)")
    .eq("status", "live")
    .order("date", { ascending: true });
  if (error) {
    console.log("fetchLiveSlotCards failed", error.message);
    return [];
  }

  const rows = data ?? [];
  const athleteIds = [...new Set(rows.map((row) => row.athlete_id).filter(Boolean))];

  const { data: avatars } = athleteIds.length
    ? await supabase.from("avatars").select("athlete_id, ready, glb_url").in("athlete_id", athleteIds)
    : { data: [] as Array<{ athlete_id: string; ready?: boolean | null; glb_url?: string | null }> };

  const readyAthletes = new Set((avatars ?? []).filter(isReadyAvatar).map((row) => row.athlete_id));
  const live = rows.filter((row) => readyAthletes.has(row.athlete_id));

  const { data: profiles } = live.length
    ? await supabase.from("profiles").select("id, name, sport, sport_detail, photo_url").in(
        "id",
        [...new Set(live.map((row) => row.athlete_id))],
      )
    : { data: [] };
  const byId = new Map((profiles ?? []).map((row) => [row.id, row]));

  const zoneRows = live.flatMap((row) => (row.zones ?? []) as Array<{ id: string; name: string; status: string }>);
  const leads = await loadLeadCentsByZone(zoneRows.map((zone) => zone.id));

  return live.map((row) => {
    const zones = (row.zones ?? []) as Array<{ id: string; name: string; status: string }>;
    const profile = byId.get(row.athlete_id);
    const sport = athleteSportLabel(profile?.sport, profile?.sport_detail) ?? row.sport?.trim() ?? null;
    const race = raceForListing(row, OFFICIAL_EVENTS);
    const slot = featuredSlot(zones.map((zone) => ({ name: zone.name, status: zone.status, current_cents: leads.get(zone.id) ?? null })));
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
      priceCents: slot.current_cents ?? FLOOR_CENTS,
      zoneLabel: slot.label,
    };
  });
}

// ---------- official race catalog ----------

export async function fetchOfficialEvents(sport?: string | null): Promise<OfficialEvent[]> {
  const fallback = sport ? upcomingOfficialEvents(sport) : allUpcomingOfficialEvents();
  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from("official_events")
    .select("starts_on, name, city, country, sport, combat_subtype, official_url, og_image_url, venue")
    .gte("starts_on", today)
    .order("starts_on", { ascending: true });
  if (sport) query = query.eq("sport", sport);
  const { data, error } = await query;
  if (error || !data?.length) {
    return fallback;
  }
  return data as OfficialEvent[];
}

export async function fetchOfficialEventByStartsOn(startsOn: string): Promise<OfficialEvent | null> {
  const { data } = await supabase
    .from("official_events")
    .select("starts_on, name, city, country, sport, combat_subtype, official_url, og_image_url, venue")
    .eq("starts_on", startsOn)
    .maybeSingle();
  if (data) return data as OfficialEvent;
  return OFFICIAL_EVENTS.find((row) => row.starts_on === startsOn) ?? null;
}

// ---------- public athlete profile (/a/[handle]) ----------

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

export async function fetchAthleteByHandle(rawHandle: string): Promise<PublicAthlete | null> {
  const handle = rawHandle.trim().toLowerCase();
  if (!handle) return null;

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, name, country, social, socials, sport, sport_detail, photo_url")
    .eq("role", "athlete");
  const profile = (rows ?? []).find((row) => publicAthleteHandle(row) === handle);
  if (!profile) return null;

  const { data: avatar } = await supabase.from("avatars").select("ready, glb_url").eq("athlete_id", profile.id).maybeSingle();
  const ready = isReadyAvatar(avatar);

  const { data: events } = await supabase
    .from("events")
    .select("name, date, slug, city, sport, status, zones(id, name, status)")
    .eq("athlete_id", profile.id)
    .in("status", [...PUBLISHED_EVENT_STATUSES])
    .order("date", { ascending: false });

  const published = ready ? (events ?? []) : [];
  const live = published.find((event) => event.status === "live") ?? null;
  const liveZones = (live?.zones ?? []) as Array<{ id: string; name: string; status: string }>;
  const leads = live ? await loadLeadCentsByZone(liveZones.map((zone) => zone.id)) : new Map<string, number>();
  const slot = featuredSlot(liveZones.map((zone) => ({ name: zone.name, status: zone.status, current_cents: leads.get(zone.id) ?? null })));

  return {
    id: profile.id,
    name: profile.name?.trim() || "Athlete",
    country: profile.country,
    social: profile.social,
    socials: profile.socials ?? null,
    handle,
    sport: profile.sport?.trim() || live?.sport || null,
    sportDetail: profile.sport_detail?.trim() || null,
    photoUrl: profile.photo_url?.trim() || null,
    liveEvent: live
      ? {
          name: live.name,
          date: live.date,
          slug: live.slug,
          city: live.city,
          sport: live.sport,
          openCount: liveZones.filter((zone) => zone.status === "open").length,
          slotLabel: slot.label,
          slotCents: slot.current_cents ?? FLOOR_CENTS,
        }
      : null,
  };
}

// ---------- event detail (/e/[slug]) ----------

export type EventDetail = {
  id: string;
  athleteId: string;
  athleteName: string;
  photoUrl: string | null;
  name: string;
  date: string;
  city: string | null;
  sport: string | null;
  slug: string;
  status: string;
  zones: Array<{
    id: string;
    name: string;
    status: string;
    leadCents: number | null;
    leadBrandId: string | null;
    leadStatus: "held" | "won" | null;
  }>;
};

export async function fetchEventBySlug(slug: string): Promise<EventDetail | null> {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, athlete_id, name, date, city, sport, slug, status, zones(id, name, status)")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !event) return null;

  const { data: profile } = await supabase.from("profiles").select("name, photo_url").eq("id", event.athlete_id).maybeSingle();

  const zoneRows = (event.zones ?? []) as Array<{ id: string; name: string; status: string }>;
  const { data: bids } = zoneRows.length
    ? await supabase
        .from("bids")
        .select("zone_id, amount_cents, status, brand_id")
        .in("zone_id", zoneRows.map((zone) => zone.id))
        .in("status", ["held", "won"])
    : { data: [] };

  const leadByZone = new Map<string, { amount_cents: number; brand_id: string; status: "held" | "won" }>();
  for (const bid of bids ?? []) {
    const current = leadByZone.get(bid.zone_id);
    if (!current || bid.amount_cents >= current.amount_cents) {
      leadByZone.set(bid.zone_id, { amount_cents: bid.amount_cents, brand_id: bid.brand_id, status: bid.status === "won" ? "won" : "held" });
    }
  }

  return {
    id: event.id,
    athleteId: event.athlete_id,
    athleteName: profile?.name?.trim() || "Athlete",
    photoUrl: profile?.photo_url?.trim() || null,
    name: event.name,
    date: event.date,
    city: event.city,
    sport: event.sport,
    slug: event.slug,
    status: event.status,
    zones: zoneRows.map((zone) => {
      const lead = leadByZone.get(zone.id);
      return {
        id: zone.id,
        name: zone.name,
        status: zone.status,
        leadCents: lead?.amount_cents ?? null,
        leadBrandId: lead?.brand_id ?? null,
        leadStatus: lead?.status ?? null,
      };
    }),
  };
}

export type ZoneBidItem = {
  id: string;
  brandName: string;
  amountCents: number;
  createdAt: string;
  status: BidStatus;
};

export async function fetchZoneBids(zoneId: string, limit = 10): Promise<ZoneBidItem[]> {
  const { data } = await supabase
    .from("bids")
    .select("id, amount_cents, status, created_at, brand_id")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const bids = data ?? [];
  if (!bids.length) return [];
  const { data: brands } = await supabase.from("profiles").select("id, name").in("id", [...new Set(bids.map((b) => b.brand_id))]);
  const names = new Map((brands ?? []).map((row) => [row.id, row.name?.trim() || "Brand"]));
  return bids.map((bid) => ({
    id: bid.id,
    brandName: names.get(bid.brand_id) ?? "Brand",
    amountCents: bid.amount_cents,
    createdAt: bid.created_at,
    status: bid.status as BidStatus,
  }));
}

// ---------- me dashboard ----------

export async function fetchMyEvent(athleteId: string) {
  const { data } = await supabase
    .from("events")
    .select("id, name, date, city, sport, slug, status, zones(id, name, status)")
    .eq("athlete_id", athleteId)
    .in("status", ["draft", "live", "closed", "done"])
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function fetchMyBids(brandId: string) {
  const { data } = await supabase
    .from("bids")
    .select("id, amount_cents, status, mark_kind, created_at, zone_id, zones(name, event_id, events(name, slug, date))")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ---------- notifications ----------

export async function fetchNotifications(userId: string): Promise<NoticeRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.log("fetchNotifications failed", error.message);
    return [];
  }
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export async function countUnreadNotifications(userId: string) {
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

export { isMarkKind };
export type { MarkKind };
