import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { categoryHoldsOtherZone } from "@/lib/category-lock";
import { brandOnboardingComplete } from "@/lib/config";
import {
  BANNED_LOGO_LINE,
  LOGOS_BUCKET,
  MAX_LOGO_BYTES,
  isBannedLogoText,
  isPngBytes,
  isPngFile,
} from "@/lib/logo";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || !profile) {
    return NextResponse.json({ error: "Log in as a brand." }, { status: 401 });
  }
  if (profile.role !== "brand" || !brandOnboardingComplete(profile)) {
    return NextResponse.json({ error: "Finish brand profile first." }, { status: 403 });
  }
  if (!takeToken(`logo:${user.id}`, 12, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Wait a minute." }, { status: 429 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Logo upload needs the service role key." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad logo payload." }, { status: 400 });
  }

  const zoneId = String(form.get("zone_id") ?? "").trim();
  if (!zoneId || zoneId.startsWith("demo-") || zoneId.startsWith("missing-")) {
    return NextResponse.json({ error: "Pick a zone first." }, { status: 400 });
  }
  const uploaded = form.get("file");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    return NextResponse.json({ error: "Add a PNG logo." }, { status: 400 });
  }
  const file = uploaded;
  if (!isPngFile(file)) {
    return NextResponse.json({ error: "Logo must be a PNG." }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be under 2 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPngBytes(bytes)) {
    return NextResponse.json({ error: "Logo must be a PNG." }, { status: 400 });
  }
  if (isBannedLogoText(file.name, profile.name, profile.website)) {
    return NextResponse.json({ error: BANNED_LOGO_LINE }, { status: 400 });
  }

  const { data: zone } = await admin
    .from("zones")
    .select("id, event_id")
    .eq("id", zoneId)
    .maybeSingle();
  if (!zone) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 });
  }

  const { data: occupying } = await admin
    .from("bids")
    .select("id, brand_id, status, amount_cents")
    .eq("zone_id", zone.id)
    .in("status", ["held", "won"])
    .order("amount_cents", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!occupying || occupying.brand_id !== user.id) {
    return NextResponse.json(
      { error: "Hold or win this zone first." },
      { status: 403 },
    );
  }

  const locked = await categoryHoldsOtherZone(
    admin,
    zone.event_id,
    zone.id,
    user.id,
    profile.brand_category,
  );
  if (locked) {
    return NextResponse.json({ error: BANNED_LOGO_LINE }, { status: 400 });
  }

  const path = `${user.id}/logo.png`;
  const blob = new Blob([bytes], { type: "image/png" });
  const { error: uploadError } = await admin.storage
    .from(LOGOS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType: "image/png",
      cacheControl: "3600",
    });
  if (uploadError) {
    console.log("Logo upload failed", uploadError.message);
    return NextResponse.json({ error: "Could not store the logo." }, { status: 500 });
  }

  const publicUrl = admin.storage.from(LOGOS_BUCKET).getPublicUrl(path).data
    .publicUrl;
  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ logo_url: logoUrl })
    .eq("id", user.id);
  if (profileError) {
    console.log("Logo profile save failed", profileError.message);
    return NextResponse.json({ error: "Could not save the logo." }, { status: 500 });
  }

  const { data: event } = await admin
    .from("events")
    .select("slug")
    .eq("id", zone.event_id)
    .maybeSingle();
  if (event?.slug) {
    revalidatePath(`/e/${event.slug}`);
    revalidatePath("/e/[slug]", "page");
  }

  console.log("Logo saved", occupying.id, occupying.status, path);
  return NextResponse.json({
    logo_url: logoUrl,
    status: occupying.status,
  });
}
