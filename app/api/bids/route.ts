import { NextResponse } from "next/server";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { categoryHoldsOtherZone } from "@/lib/category-lock";
import { closeEventAuction } from "@/lib/close-auctions";
import {
  BID_STEP_CENTS,
  brandOnboardingComplete,
  canAdvertiseOnEvent,
} from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { eventPageReady } from "@/lib/event-create";
import { logoDeskPath } from "@/lib/logo";
import { isPublishedEventStatus } from "@/lib/types";
import { holdPaidPendingBids } from "@/lib/hold-bid";
import { nextBidCents } from "@/lib/money";
import {
  checkoutHost,
  createBidCheckout,
  createWhopClient,
  describeWhopError,
  logWhopEnv,
  resolveWhopCompanyId,
  whopPaymentsEnabled,
} from "@/lib/whop";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/admin";
import { isPersistedZoneId, loadLastZoneBids } from "@/lib/zone-bids";
import { isZoneName } from "@/lib/zones";
import { loadAthleteZoneRects } from "@/lib/athlete-zone-rects";
import { isHiddenPhotoZone } from "@/lib/zone-photos";
import { SHOW_3D_BODY } from "@/lib/feature-flags";

type Body = {
  slug?: string;
  zone_id?: string;
  zone_name?: string;
  amount_cents?: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim() ?? "";
  const zoneId = url.searchParams.get("zone_id")?.trim() ?? "";
  if (!slug || slug === DEMO_SLUG || !isPersistedZoneId(zoneId)) {
    return NextResponse.json({ bids: [] });
  }

  const db = createPublicSupabase();
  if (!db) {
    return NextResponse.json({ bids: [] });
  }

  const { data: event } = await db
    .from("events")
    .select("id, athlete_id, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!event || !isPublishedEventStatus(event.status)) {
    return NextResponse.json({ bids: [] });
  }

  const { data: avatar } = await db
    .from("avatars")
    .select("glb_url, ready")
    .eq("athlete_id", event.athlete_id)
    .maybeSingle();
  if (
    !(await eventPageReady({
      slug,
      athleteId: event.athlete_id,
      avatar,
    }))
  ) {
    return NextResponse.json({ bids: [] });
  }

  const { data: zone } = await db
    .from("zones")
    .select("id")
    .eq("id", zoneId)
    .eq("event_id", event.id)
    .maybeSingle();
  if (!zone) {
    return NextResponse.json({ bids: [] });
  }

  return NextResponse.json({
    bids: await loadLastZoneBids(db, zone.id),
  });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad bid payload." }, { status: 400 });
  }
  const slug = body.slug?.trim() ?? "";
  const zoneId = body.zone_id?.trim() ?? "";

  if (!user || !profile) {
    return NextResponse.json({ error: "Log in as a brand." }, { status: 401 });
  }
  if (profile.role !== "brand") {
    return NextResponse.json({ error: "Only brands bid." }, { status: 403 });
  }
  if (!brandOnboardingComplete(profile)) {
    return NextResponse.json(
      { error: "Finish brand name, website, and category first." },
      { status: 403 },
    );
  }
  if (!takeToken(`bid:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many bids. Wait a minute." }, { status: 429 });
  }
  if (!slug || slug === DEMO_SLUG || zoneId.startsWith("demo-") || zoneId.startsWith("missing-")) {
    return NextResponse.json(
      { error: "This preview does not take bids." },
      { status: 400 },
    );
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json(
      { error: "Bidding needs the service role key." },
      { status: 503 },
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, athlete_id, date, status, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!event || event.status !== "live") {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }
  if (
    !canAdvertiseOnEvent({
      role: profile.role,
      userId: user.id,
      athleteId: event.athlete_id,
    })
  ) {
    return NextResponse.json(
      { error: "You cannot bid on your own event." },
      { status: 403 },
    );
  }
  const { data: avatar } = await supabase
    .from("avatars")
    .select("glb_url, ready")
    .eq("athlete_id", event.athlete_id)
    .maybeSingle();
  if (
    !(await eventPageReady({
      slug: event.slug,
      athleteId: event.athlete_id,
      avatar,
    }))
  ) {
    return NextResponse.json({ error: "Event is not live." }, { status: 400 });
  }
  // Close bidding when now > event_start - 48 hours.
  if (isAuctionClosed(event.date)) {
    await closeEventAuction(event.id);
    return NextResponse.json({ error: "Auction is closed." }, { status: 400 });
  }

  let zoneQuery = supabase
    .from("zones")
    .select("id, name, status")
    .eq("event_id", event.id)
    .eq("id", zoneId);
  if (body.zone_name && isZoneName(body.zone_name)) {
    zoneQuery = supabase
      .from("zones")
      .select("id, name, status")
      .eq("event_id", event.id)
      .eq("id", zoneId)
      .eq("name", body.zone_name);
  }
  const { data: zone } = await zoneQuery.maybeSingle();
  if (!zone || zone.status !== "open") {
    return NextResponse.json({ error: "Zone is closed." }, { status: 400 });
  }

  if (!isZoneName(zone.name) || isHiddenPhotoZone(zone.name)) {
    return NextResponse.json({ error: "This placement is not available." }, { status: 400 });
  }
  if (!SHOW_3D_BODY) {
    const placements = await loadAthleteZoneRects(admin, event.athlete_id);
    if (!placements[zone.name]) {
      return NextResponse.json({ error: "The athlete has not positioned this placement yet." }, { status: 409 });
    }
  }

  await holdPaidPendingBids([zone.id]);

  const { data: held } = await admin
    .from("bids")
    .select("id, amount_cents, brand_id")
    .eq("zone_id", zone.id)
    .eq("status", "held")
    .order("amount_cents", { ascending: false })
    .limit(1)
    .maybeSingle();

  const minAsk = nextBidCents(held?.amount_cents ?? null);
  const requested = Number(body.amount_cents);
  const amount = Number.isFinite(requested) ? requested : minAsk;
  if (amount < minAsk || amount % BID_STEP_CENTS !== 0) {
    return NextResponse.json(
      { error: `Next bid is ${minAsk / 100} USD.` },
      { status: 409 },
    );
  }

  const locked = await categoryHoldsOtherZone(
    admin,
    event.id,
    zone.id,
    user.id,
    profile.brand_category,
  );
  if (locked) {
    return NextResponse.json(
      { error: "This category already holds a zone on this event." },
      { status: 400 },
    );
  }

  logWhopEnv();
  if (!whopPaymentsEnabled()) {
    return NextResponse.json(
      { error: "Payments are not ready." },
      { status: 503 },
    );
  }

  return startWhopCheckout({
    admin,
    slug,
    zoneId: zone.id,
    zoneName: zone.name,
    brandId: user.id,
    amount,
  });
}

async function startWhopCheckout(input: {
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>;
  slug: string;
  zoneId: string;
  zoneName: string;
  brandId: string;
  amount: number;
}) {
  const whop = createWhopClient();
  const companyId = resolveWhopCompanyId();
  if (!whop || !companyId) {
    return NextResponse.json({ error: "Payments are not ready." }, { status: 503 });
  }

  const { data: bid, error: bidError } = await input.admin
    .from("bids")
    .insert({
      zone_id: input.zoneId,
      brand_id: input.brandId,
      amount_cents: input.amount,
      status: "pending",
    })
    .select("id")
    .single();
  if (bidError || !bid) {
    console.log("Bid insert failed", bidError?.message);
    return NextResponse.json({ error: "Could not place the bid." }, { status: 500 });
  }

  try {
    const checkout = await createBidCheckout({
      whop,
      companyId,
      amountCents: input.amount,
      bidId: bid.id,
      zoneId: input.zoneId,
      brandId: input.brandId,
      slug: input.slug,
    });
    const checkoutUrl = checkout.purchase_url?.trim() || null;
    if (!checkoutUrl) {
      console.log("Whop checkout failed", bid.id, "no checkout URL");
      await input.admin.from("bids").update({ status: "failed" }).eq("id", bid.id);
      return NextResponse.json(
        { error: "Checkout did not open. Try again." },
        { status: 502 },
      );
    }
    await input.admin
      .from("bids")
      .update({ whop_checkout_id: checkout.id })
      .eq("id", bid.id);
    console.log(
      "Whop checkout",
      bid.id,
      input.zoneName,
      input.amount,
      checkout.id,
      checkoutHost(checkoutUrl),
    );
    return NextResponse.json({
      bid_id: bid.id,
      amount_cents: input.amount,
      status: "pending",
      checkout_url: checkoutUrl,
      logo_path: logoDeskPath(input.slug, bid.id),
    });
  } catch (error) {
    const detail = describeWhopError(error);
    console.log("Whop checkout failed", detail.status, detail.message);
    await input.admin.from("bids").update({ status: "failed" }).eq("id", bid.id);
    return NextResponse.json(
      { error: "Checkout did not open. Try again." },
      { status: 502 },
    );
  }
}
