import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { athleteOnboardingComplete } from "@/lib/config";
import { takeToken } from "@/lib/rate-limit";
import { isPersistedZoneId } from "@/lib/zone-bids";
import {
  HELD_OR_WON,
  isZoneStatus,
  zoneToggleError,
} from "@/lib/zone-status";

type Body = {
  zone_id?: string;
  status?: string;
};

export async function PATCH(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || !profile) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile.role !== "athlete" || !athleteOnboardingComplete(profile)) {
    return NextResponse.json({ error: "Only the athlete can close zones." }, { status: 403 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  if (!takeToken(`zone:${user.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many zone changes. Wait a minute." }, { status: 429 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad zone payload." }, { status: 400 });
  }

  const zoneId = body.zone_id?.trim() ?? "";
  const nextStatus = body.status?.trim() ?? "";
  if (!isPersistedZoneId(zoneId) || !isZoneStatus(nextStatus)) {
    return NextResponse.json({ error: "Pick a real zone." }, { status: 400 });
  }

  const { data: zone } = await supabase
    .from("zones")
    .select("id, status, event_id")
    .eq("id", zoneId)
    .maybeSingle();
  if (!zone) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, date, athlete_id, status")
    .eq("id", zone.event_id)
    .eq("athlete_id", user.id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Only the athlete can close zones." }, { status: 403 });
  }

  const { count } = await supabase
    .from("bids")
    .select("id", { count: "exact", head: true })
    .eq("zone_id", zone.id)
    .in("status", [...HELD_OR_WON]);
  const hasHeldOrWon = (count ?? 0) > 0;

  const reason = zoneToggleError({
    from: zone.status === "closed" ? "closed" : "open",
    to: nextStatus,
    hasHeldOrWon,
    eventDate: event.date,
  });
  if (reason) {
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("zones")
    .update({ status: nextStatus })
    .eq("id", zone.id)
    .eq("event_id", event.id)
    .select("id, status")
    .single();
  if (error || !updated) {
    console.log("Zone update failed", error?.message);
    return NextResponse.json(
      { error: triggerError(error?.message, nextStatus) },
      { status: 400 },
    );
  }

  console.log("Zone", nextStatus, updated.id, event.slug);
  revalidatePath("/me");
  revalidatePath("/events");
  if (event.status !== "draft" && event.slug) {
    revalidatePath(`/e/${event.slug}`);
    revalidatePath("/e/[slug]", "page");
  }
  revalidatePath("/a/[handle]", "page");
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
  });
}

function triggerError(message: string | undefined, nextStatus: string) {
  if (message?.includes("held or won")) {
    return "Cannot close a zone that is held or won.";
  }
  if (message?.includes("T–48h") || message?.includes("T-48h")) {
    return "Cannot reopen after T–48h.";
  }
  return nextStatus === "closed"
    ? "Could not close the zone."
    : "Could not reopen the zone.";
}
