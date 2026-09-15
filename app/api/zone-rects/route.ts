import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { athleteIsAdult, athleteSportComplete } from "@/lib/config";
import { parseZoneRect } from "@/lib/athlete-zone-rects";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isZoneName } from "@/lib/zones";
import { isHiddenPhotoZone } from "@/lib/zone-photos";
import { loadBodyPhotos } from "@/lib/body-photos";
import { zonePhotoSide } from "@/lib/zone-photos";

type Body = {
  zone_name?: string;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  athlete_id?: string;
};

export async function PUT(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || !profile) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  const adminUser = isAdminEmail(user.email);
  if (
    !adminUser &&
    (profile.role !== "athlete" ||
      !athleteIsAdult(profile) ||
      !athleteSportComplete(profile))
  ) {
    return NextResponse.json({ error: "Only the athlete can place slots." }, { status: 403 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }
  if (!takeToken(`zone-rect:${user.id}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many slot saves. Wait a minute." }, { status: 429 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad slot payload." }, { status: 400 });
  }

  const zoneName = body.zone_name?.trim() ?? "";
  if (!isZoneName(zoneName) || isHiddenPhotoZone(zoneName)) {
    return NextResponse.json({ error: "Pick a real zone." }, { status: 400 });
  }
  const rect = parseZoneRect(body);
  if (!rect) {
    return NextResponse.json({ error: "Draw a rectangle on the photo." }, { status: 400 });
  }

  const athleteId = adminUser
    ? (body.athlete_id?.trim() || user.id)
    : user.id;
  if (!adminUser && athleteId !== user.id) {
    return NextResponse.json({ error: "Only the athlete can place slots." }, { status: 403 });
  }

  const db = adminUser ? createAdminSupabase() ?? supabase : supabase;
  const photos = await loadBodyPhotos(athleteId);
  if (!photos[zonePhotoSide(zoneName)]) {
    return NextResponse.json({ error: "Approve your photos before positioning placements." }, { status: 409 });
  }
  const { data: events, error: eventError } = await db.from("events").select("id").eq("athlete_id", athleteId).in("status", ["draft", "live", "closed"]);
  if (eventError) return NextResponse.json({ error: "Could not check your active placements. Try again." }, { status: 503 });
  if (events?.length) {
    const { data: zones, error: zoneError } = await db.from("zones").select("id").in("event_id", events.map((event) => event.id)).eq("name", zoneName);
    if (zoneError) return NextResponse.json({ error: "Could not check this placement. Try again." }, { status: 503 });
    if (zones?.length) {
      // Use the service client: athlete RLS must not hide a brand's paid/pending bid.
      const bidDb = createAdminSupabase();
      if (!bidDb) return NextResponse.json({ error: "Could not check sponsorship payments." }, { status: 503 });
      const { data: bids, error: bidError } = await bidDb.from("bids").select("id").in("zone_id", zones.map((zone) => zone.id)).in("status", ["pending", "held", "won"]).limit(1);
      if (bidError) return NextResponse.json({ error: "Could not check sponsorship payments." }, { status: 503 });
      if (bids?.length) return NextResponse.json({ error: "This placement has a paid or pending bid. Its position is locked for this race." }, { status: 409 });
    }
  }
  const { error } = await db.from("athlete_zone_rects").upsert({
    athlete_id: athleteId,
    zone_name: zoneName,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  });
  if (error) {
    console.log("athlete_zone_rects save failed", error.message);
    return NextResponse.json(
      { error: "Could not save the slot. Run athlete-zone-rects.sql in Supabase." },
      { status: 500 },
    );
  }

  console.log("Zone rect saved", athleteId, zoneName, rect);
  revalidatePath("/me");
  revalidatePath("/new");
  revalidatePath("/events");
  revalidatePath("/athletes");
  revalidatePath("/a/[handle]", "page");
  revalidatePath("/e/[slug]", "page");
  return NextResponse.json({ ok: true, zone_name: zoneName, ...rect });
}
