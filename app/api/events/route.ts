import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { athleteOnboardingComplete, athleteSportComplete } from "@/lib/config";
import { isMissingColumn } from "@/lib/db-error";
import {
  activeEvents,
  athleteAvatarReady,
  demoteLiveWithoutReadyGlb,
  insertErrorMessage,
  parseEventCreateBody,
  zoneRows,
  type EventCreateBody,
} from "@/lib/event-create";

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete" || !athleteOnboardingComplete(profile)) {
    return NextResponse.json(
      { error: "Finish athlete payout details first." },
      { status: 403 },
    );
  }
  if (!athleteSportComplete(profile)) {
    return NextResponse.json(
      { error: "Pick a sport on your profile." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as EventCreateBody;
  const parsed = parseEventCreateBody(body, {
    country: profile.country,
    sport: profile.sport,
    sport_detail: profile.sport_detail,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  await demoteLiveWithoutReadyGlb(supabase, user.id);

  const active = await activeEvents(supabase, user.id);
  if (active.live || active.draft) {
    return NextResponse.json(
      { error: "One live event at a time." },
      { status: 400 },
    );
  }

  const { data: slugTaken } = await supabase
    .from("events")
    .select("id")
    .eq("slug", parsed.slug)
    .maybeSingle();
  if (slugTaken) {
    return NextResponse.json({ error: "That URL is taken." }, { status: 400 });
  }

  // No ready GLB → draft. Never insert live without a scan.
  const ready = await athleteAvatarReady(supabase, user.id);
  const status = ready ? "live" : "draft";

  const eventRow = {
    athlete_id: user.id,
    name: parsed.name,
    date: new Date(parsed.date).toISOString(),
    city: parsed.city,
    country: parsed.country,
    sport: parsed.sport,
    sport_detail: parsed.sport_detail,
    slug: parsed.slug,
    status,
    likeness_opt_in: parsed.likeness_opt_in,
    appearance_price_cents: parsed.appearance_price_cents,
  };

  let insertRow: Record<string, unknown> = eventRow;
  let { data: event, error } = await supabase
    .from("events")
    .insert(insertRow)
    .select("id, slug, status")
    .single();
  for (const column of ["sport_detail", "country"] as const) {
    if (!error || !isMissingColumn(error, column)) {
      continue;
    }
    const { [column]: _omit, ...rest } = insertRow;
    void _omit;
    insertRow = rest;
    ({ data: event, error } = await supabase
      .from("events")
      .insert(insertRow)
      .select("id, slug, status")
      .single());
  }

  if (error || !event) {
    console.log("Event insert failed", error?.message);
    return NextResponse.json(
      { error: insertErrorMessage(error ?? {}) },
      { status: 500 },
    );
  }

  // Always spawn the 12 named zones. Default open unless the athlete closed one.
  const { error: zoneError } = await supabase
    .from("zones")
    .insert(zoneRows(event.id, parsed.zones));
  if (zoneError) {
    console.log("Zone insert failed", zoneError.message);
    return NextResponse.json(
      { error: "Event saved, zones failed." },
      { status: 500 },
    );
  }

  const published = event.status === "live" && ready;
  if (event.status === "live" && !ready) {
    await demoteLiveWithoutReadyGlb(supabase, user.id);
  }

  console.log("Event created", event.slug, published ? "live" : "draft");
  revalidatePath("/new");
  if (published) {
    revalidatePath("/events");
    revalidatePath(`/e/${event.slug}`);
  }
  return NextResponse.json({
    id: event.id,
    slug: event.slug,
    status: published ? "live" : "draft",
  });
}

export async function PATCH() {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete" || !athleteOnboardingComplete(profile)) {
    return NextResponse.json(
      { error: "Finish athlete payout details first." },
      { status: 403 },
    );
  }

  await demoteLiveWithoutReadyGlb(supabase, user.id);

  const active = await activeEvents(supabase, user.id);
  if (active.live) {
    return NextResponse.json(
      { error: "One live event at a time.", slug: active.live.slug, status: "live" },
      { status: 400 },
    );
  }
  if (!active.draft) {
    return NextResponse.json({ error: "No draft event to publish." }, { status: 400 });
  }

  const ready = await athleteAvatarReady(supabase, user.id);
  if (!ready) {
    return NextResponse.json(
      {
        error: "Scan required.",
        slug: active.draft.slug,
        status: "draft",
      },
      { status: 400 },
    );
  }

  const { data: event, error } = await supabase
    .from("events")
    .update({ status: "live" })
    .eq("id", active.draft.id)
    .eq("athlete_id", user.id)
    .eq("status", "draft")
    .select("slug, status")
    .single();

  if (error || !event || event.status !== "live") {
    console.log("Event publish failed", error?.message);
    return NextResponse.json(
      {
        error: "Scan required.",
        slug: active.draft.slug,
        status: "draft",
      },
      { status: 400 },
    );
  }

  const stillReady = await athleteAvatarReady(supabase, user.id);
  if (!stillReady) {
    await demoteLiveWithoutReadyGlb(supabase, user.id);
    return NextResponse.json(
      {
        error: "Scan required.",
        slug: active.draft.slug,
        status: "draft",
      },
      { status: 400 },
    );
  }

  console.log("Event published", event.slug);
  revalidatePath("/new");
  revalidatePath("/events");
  revalidatePath(`/e/${event.slug}`);
  return NextResponse.json({ slug: event.slug, status: "live" });
}
