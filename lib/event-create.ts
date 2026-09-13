import { eventDateWindowError, eventSlugError, normalizeEventSlug } from "@/lib/auction";
import { parseAthleteSport } from "@/lib/config";
import { isCountry } from "@/lib/countries";
import { ZONE_NAMES, isZoneName } from "@/lib/zones";
import type { createServerSupabase } from "@/lib/supabase/server";

export type EventCreateBody = {
  name?: string;
  date?: string;
  city?: string;
  country?: string;
  sport?: string;
  sport_detail?: string | null;
  slug?: string;
  likeness_opt_in?: boolean;
  appearance_price_cents?: number | null;
  zones?: Record<string, "open" | "closed">;
};

type Db = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

type AvatarFields = {
  ready?: boolean | null;
  glb_url?: string | null;
};

function isDemoOrPlaceholderGlb(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes("placeholder.glb") ||
    lower.includes("avatar-male.glb") ||
    lower.includes("avatar-female.glb")
  );
}

// Real scan only. Landing Alex and placeholder.glb never count as ready.
export function isReadyAvatar(
  avatar: AvatarFields | null | undefined,
): avatar is { ready: true; glb_url: string } {
  const url = avatar?.glb_url?.trim() ?? "";
  if (!avatar?.ready || !url) {
    return false;
  }
  return !isDemoOrPlaceholderGlb(url);
}

export async function athleteAvatarReady(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("avatars")
    .select("ready, glb_url")
    .eq("athlete_id", userId)
    .maybeSingle();
  return isReadyAvatar(data);
}

export async function readyAthleteIdSet(supabase: Db, athleteIds: string[]) {
  const unique = [...new Set(athleteIds.filter(Boolean))];
  if (unique.length === 0) {
    return new Set<string>();
  }
  const { data } = await supabase
    .from("avatars")
    .select("athlete_id, ready, glb_url")
    .in("athlete_id", unique);
  return new Set(
    (data ?? [])
      .filter((row) => isReadyAvatar(row))
      .map((row) => row.athlete_id),
  );
}

// Live without a scan is a bug. Pull it back to draft.
export async function demoteLiveWithoutReadyGlb(supabase: Db, userId: string) {
  const ready = await athleteAvatarReady(supabase, userId);
  if (ready) {
    return false;
  }
  await supabase
    .from("events")
    .update({ status: "draft" })
    .eq("athlete_id", userId)
    .eq("status", "live");
  return true;
}

export async function activeEvents(supabase: Db, userId: string) {
  const { data } = await supabase
    .from("events")
    .select("id, slug, status")
    .eq("athlete_id", userId)
    .in("status", ["draft", "live"]);
  const rows = data ?? [];
  return {
    live: rows.find((row) => row.status === "live") ?? null,
    draft: rows.find((row) => row.status === "draft") ?? null,
  };
}

export function parseEventCreateBody(
  body: EventCreateBody,
  saved?: {
    country?: string | null;
    sport?: string | null;
    sport_detail?: string | null;
  },
) {
  const name = (body.name ?? "").trim();
  const city = (body.city ?? "").trim();
  const country = (body.country ?? "").trim();
  const date = body.date ?? "";
  const slug = normalizeEventSlug(body.slug || name);

  if (!name) {
    return { ok: false as const, error: "Enter the event name." };
  }
  if (!country || (!isCountry(country) && country !== (saved?.country ?? "").trim())) {
    return { ok: false as const, error: "Pick the country." };
  }
  if (!city) {
    return { ok: false as const, error: "Enter the city." };
  }
  const parsedSport = parseAthleteSport(saved?.sport, saved?.sport_detail);
  if (!parsedSport.ok) {
    return { ok: false as const, error: "Pick a sport on your profile." };
  }
  const dateError = eventDateWindowError(date);
  if (dateError) {
    return { ok: false as const, error: dateError };
  }
  const slugError = eventSlugError(slug);
  if (slugError) {
    return { ok: false as const, error: slugError };
  }

  const closedCount = ZONE_NAMES.filter(
    (zoneName) =>
      body.zones && isZoneName(zoneName) && body.zones[zoneName] === "closed",
  ).length;
  if (closedCount === ZONE_NAMES.length) {
    return { ok: false as const, error: "Leave at least one zone open." };
  }

  return {
    ok: true as const,
    name,
    city,
    country,
    sport: parsedSport.sport,
    sport_detail: parsedSport.sport_detail,
    date,
    slug,
    likeness_opt_in: Boolean(body.likeness_opt_in),
    appearance_price_cents: body.appearance_price_cents ?? null,
    zones: body.zones,
  };
}

export function zoneRows(
  eventId: string,
  zones: EventCreateBody["zones"],
) {
  return ZONE_NAMES.map((zoneName) => ({
    event_id: eventId,
    name: zoneName,
    status:
      zones && isZoneName(zoneName) && zones[zoneName] === "closed"
        ? "closed"
        : ("open" as const),
  }));
}

export function insertErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    if (error.message?.includes("slug")) {
      return "That URL is taken.";
    }
    return "One live event at a time.";
  }
  return "Could not create the event.";
}
