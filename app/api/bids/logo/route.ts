import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { categoryHoldsOtherZone } from "@/lib/category-lock";
import { closeEventAuction } from "@/lib/close-auctions";
import { brandOnboardingComplete } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { isMissingColumn } from "@/lib/db-error";
import { isPublishedEventStatus } from "@/lib/types";
import {
  BANNED_LOGO_LINE,
  demoLogoStoragePath,
  isBannedLogoText,
  isMarkKind,
  isPngBytes,
  isPngFile,
  LOGOS_BUCKET,
  MAX_LOGO_BYTES,
  parseMarkOffer,
  postRulesError,
  zoneLogoStoragePath,
  type MarkKind,
} from "@/lib/logo";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isPersistedZoneId } from "@/lib/zone-bids";
import { isZoneName } from "@/lib/zones";

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad logo payload." }, { status: 400 });
  }

  const slug = String(form.get("slug") ?? "").trim();
  const zoneId = String(form.get("zone_id") ?? "").trim();
  const zoneNameRaw = String(form.get("zone_name") ?? "").trim();
  const isDemo = slug === DEMO_SLUG || zoneId.startsWith("demo-");

  if (!isDemo) {
    if (!user || !profile) {
      return NextResponse.json({ error: "Log in as a brand." }, { status: 401 });
    }
    if (profile.role !== "brand" || !brandOnboardingComplete(profile)) {
      return NextResponse.json(
        { error: "Finish brand profile first." },
        { status: 403 },
      );
    }
  }

  const rateKey = user?.id
    ? `logo:${user.id}`
    : `logo:demo:${request.headers.get("x-forwarded-for") ?? "anon"}`;
  if (!takeToken(rateKey, 12, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many uploads. Wait a minute." },
      { status: 429 },
    );
  }

  if (!isZoneName(zoneNameRaw) && !isDemo && !isPersistedZoneId(zoneId)) {
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
  if (isBannedLogoText(file.name, profile?.name, profile?.website)) {
    return NextResponse.json({ error: BANNED_LOGO_LINE }, { status: 400 });
  }

  const postRules = String(form.get("post_rules") ?? "").trim();
  const rulesError = postRulesError(postRules);
  if (rulesError) {
    return NextResponse.json({ error: rulesError }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Logo upload needs the service role key." },
      { status: 503 },
    );
  }

  if (isDemo) {
    const demoName = zoneId.startsWith("demo-") ? zoneId.slice(5) : "";
    const zoneName = isZoneName(zoneNameRaw)
      ? zoneNameRaw
      : isZoneName(demoName)
        ? demoName
        : null;
    if (!zoneName) {
      return NextResponse.json({ error: "Pick a zone first." }, { status: 400 });
    }
    const offer = parseMarkOffer({ offer_tattoo: true, offer_sticker: true });
    const markKind = resolveMarkKind(String(form.get("mark_kind") ?? ""), offer.kinds);
    if (!markKind) {
      return NextResponse.json(
        { error: "Pick tattoo or sticker." },
        { status: 400 },
      );
    }
    const logoUrl = await storePng(admin, demoLogoStoragePath(zoneName), bytes);
    if (!logoUrl) {
      return NextResponse.json({ error: "Could not store the logo." }, { status: 500 });
    }
    console.log("Demo logo saved", zoneName);
    revalidatePath(`/e/${DEMO_SLUG}`);
    revalidatePath(`/e/${DEMO_SLUG}/logo`);
    return NextResponse.json({
      logo_url: logoUrl,
      mark_kind: markKind,
      post_rules: postRules,
      status: "won",
    });
  }

  if (!supabase || !user || !profile) {
    return NextResponse.json({ error: "Log in as a brand." }, { status: 401 });
  }
  if (!slug || !isPersistedZoneId(zoneId)) {
    return NextResponse.json({ error: "Pick a zone first." }, { status: 400 });
  }

  let eventQuery = supabase
    .from("events")
    .select("id, slug, date, status, offer_tattoo, offer_sticker")
    .eq("slug", slug)
    .maybeSingle();
  let { data: event, error: eventError } = await eventQuery;
  if (eventError && isMissingColumn(eventError, "offer_tattoo")) {
    ({ data: event, error: eventError } = await supabase
      .from("events")
      .select("id, slug, date, status")
      .eq("slug", slug)
      .maybeSingle());
  }
  if (eventError || !event) {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }
  if (event.status === "live" && isAuctionClosed(event.date)) {
    await closeEventAuction(event.id);
    event.status = "closed";
  }
  if (!isPublishedEventStatus(event.status)) {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }

  let zoneQuery = admin
    .from("zones")
    .select("id, name, event_id, status")
    .eq("id", zoneId)
    .eq("event_id", event.id);
  if (isZoneName(zoneNameRaw)) {
    zoneQuery = zoneQuery.eq("name", zoneNameRaw);
  }
  const { data: zone } = await zoneQuery.maybeSingle();
  if (!zone || !isZoneName(zone.name)) {
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
      { error: "Lead this zone first." },
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

  const offer = parseMarkOffer({
    offer_tattoo: event.offer_tattoo,
    offer_sticker: event.offer_sticker,
  });
  const markKind = resolveMarkKind(String(form.get("mark_kind") ?? ""), offer.kinds);
  if (!markKind) {
    return NextResponse.json(
      { error: "Pick tattoo or sticker." },
      { status: 400 },
    );
  }

  const path = zoneLogoStoragePath({
    brandId: user.id,
    eventId: event.id,
    zoneName: zone.name,
  });
  const logoUrl = await storePng(admin, path, bytes);
  if (!logoUrl) {
    return NextResponse.json({ error: "Could not store the logo." }, { status: 500 });
  }

  const saved = await saveBidLogo(admin, occupying.id, {
    logo_url: logoUrl,
    mark_kind: markKind,
    post_rules: postRules || null,
  });
  if (!saved) {
    return NextResponse.json({ error: "Could not save the logo." }, { status: 500 });
  }

  revalidatePath(`/e/${event.slug}`);
  revalidatePath(`/e/${event.slug}/logo`);
  revalidatePath("/e/[slug]", "page");
  revalidatePath("/me");
  console.log("Logo saved", occupying.id, zone.name, path);
  return NextResponse.json({
    logo_url: logoUrl,
    mark_kind: markKind,
    post_rules: postRules,
    status: occupying.status,
  });
}

function resolveMarkKind(raw: string, kinds: MarkKind[]): MarkKind | null {
  if (kinds.length === 1) {
    return kinds[0];
  }
  return isMarkKind(raw) && kinds.includes(raw) ? raw : null;
}

async function storePng(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  path: string,
  bytes: Uint8Array,
) {
  const { error } = await admin.storage.from(LOGOS_BUCKET).upload(
    path,
    new Blob([Buffer.from(bytes)], { type: "image/png" }),
    {
      upsert: true,
      contentType: "image/png",
      cacheControl: "60",
    },
  );
  if (error) {
    console.log("Logo upload failed", error.message);
    return null;
  }
  const publicUrl = admin.storage.from(LOGOS_BUCKET).getPublicUrl(path).data
    .publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}

async function saveBidLogo(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  bidId: string,
  fields: {
    logo_url: string;
    mark_kind: MarkKind;
    post_rules: string | null;
  },
) {
  let payload: Record<string, unknown> = { ...fields };
  let { error } = await admin.from("bids").update(payload).eq("id", bidId);
  for (const column of ["post_rules", "mark_kind", "logo_url"] as const) {
    if (!error || !isMissingColumn(error, column)) {
      continue;
    }
    const { [column]: _omit, ...rest } = payload;
    void _omit;
    payload = rest;
    ({ error } = await admin.from("bids").update(payload).eq("id", bidId));
  }
  if (error) {
    console.log("Logo bid save failed", error.message);
    return false;
  }
  if (!("logo_url" in payload)) {
    console.log("Logo bid save skipped logo_url");
    return false;
  }
  const { data } = await admin
    .from("bids")
    .select("logo_url")
    .eq("id", bidId)
    .maybeSingle();
  if (!data?.logo_url) {
    console.log("Logo bid save did not stick", bidId);
    return false;
  }
  return true;
}
