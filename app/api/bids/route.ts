import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { categoryHoldsOtherZone } from "@/lib/category-lock";
import { closeEventAuction, refundHeldOnZone } from "@/lib/close-auctions";
import { notifyHeldBid } from "@/lib/email";
import {
  BID_STEP_CENTS,
  FLOOR_CENTS,
  brandOnboardingComplete,
} from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { athleteAvatarReady, isReadyAvatar } from "@/lib/event-create";
import { isPublishedEventStatus } from "@/lib/types";
import { nextBidCents } from "@/lib/money";
import {
  createBidCheckout,
  createPolarClient,
  polarPaymentsEnabled,
  resolveBidProductId,
} from "@/lib/polar";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/admin";
import { isPersistedZoneId, loadLastZoneBids } from "@/lib/zone-bids";
import { isZoneName } from "@/lib/zones";

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
  if (!isReadyAvatar(avatar)) {
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
  const glbReady = await athleteAvatarReady(supabase, event.athlete_id);
  if (!glbReady) {
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

  const { data: held } = await admin
    .from("bids")
    .select("id, amount_cents, brand_id")
    .eq("zone_id", zone.id)
    .eq("status", "held")
    .order("amount_cents", { ascending: false })
    .limit(1)
    .maybeSingle();

  const amount = nextBidCents(held?.amount_cents ?? null);
  if (amount < FLOOR_CENTS || amount % BID_STEP_CENTS !== 0) {
    return NextResponse.json({ error: "Floor is $100." }, { status: 400 });
  }
  if (Number.isFinite(body.amount_cents) && body.amount_cents !== amount) {
    return NextResponse.json(
      { error: `Next bid is ${amount / 100} USD.` },
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

  if (polarPaymentsEnabled()) {
    return startPolarCheckout({
      request,
      admin,
      slug,
      zoneId: zone.id,
      zoneName: zone.name,
      brandId: user.id,
      amount,
      customerEmail: user.email,
      customerName: profile.name,
    });
  }

  // Production must take payment. Local `next dev` can still insert held.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Payments are not ready." },
      { status: 503 },
    );
  }

  // No Polar token: insert as held immediately. Page still bids.
  const { data: bid, error: bidError } = await admin
    .from("bids")
    .insert({
      zone_id: zone.id,
      brand_id: user.id,
      amount_cents: amount,
      status: "held",
    })
    .select("id")
    .single();
  if (bidError || !bid) {
    console.log("Bid insert failed", bidError?.message);
    return NextResponse.json({ error: "Could not place the bid." }, { status: 500 });
  }

  const { data: heldNow } = await admin
    .from("bids")
    .select("id, amount_cents, created_at")
    .eq("zone_id", zone.id)
    .eq("status", "held")
    .order("amount_cents", { ascending: false })
    .order("created_at", { ascending: false });
  const leader = heldNow?.[0];
  if (!leader || leader.id !== bid.id) {
    await admin.from("bids").update({ status: "refunded" }).eq("id", bid.id);
    const min = nextBidCents(leader?.amount_cents ?? null);
    return NextResponse.json(
      { error: `Next bid is ${min / 100} USD.` },
      { status: 409 },
    );
  }

  await refundHeldOnZone(zone.id, bid.id, { refundPayment: false });
  await notifyHeldBid({
    bidId: bid.id,
    athleteId: event.athlete_id,
    currentBrandId: user.id,
    zoneName: zone.name,
    amountCents: amount,
    eventSlug: event.slug,
    previousBid: held
      ? { id: held.id, brandId: held.brand_id }
      : null,
  });
  revalidatePath(`/e/${slug}`);
  revalidatePath("/e/[slug]", "page");
  console.log("Bid held", bid.id, zone.name, amount);
  return NextResponse.json({
    bid_id: bid.id,
    amount_cents: amount,
    status: "held",
  });
}

async function startPolarCheckout(input: {
  request: Request;
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>;
  slug: string;
  zoneId: string;
  zoneName: string;
  brandId: string;
  amount: number;
  customerEmail?: string | null;
  customerName?: string | null;
}) {
  const polar = createPolarClient();
  if (!polar) {
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
    const productId = await resolveBidProductId(polar);
    const forwarded = input.request.headers.get("x-forwarded-for");
    const checkout = await createBidCheckout({
      polar,
      productId,
      amountCents: input.amount,
      bidId: bid.id,
      zoneId: input.zoneId,
      brandId: input.brandId,
      slug: input.slug,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerIp:
        forwarded?.split(",")[0]?.trim() ||
        input.request.headers.get("x-real-ip")?.trim() ||
        null,
    });
    const { error: checkoutSaveError } = await input.admin
      .from("bids")
      .update({
        polar_checkout_id: checkout.id,
        dodo_checkout_id: checkout.id,
      })
      .eq("id", bid.id);
    if (checkoutSaveError) {
      console.log("Polar checkout id save", checkoutSaveError.message);
      await input.admin
        .from("bids")
        .update({ dodo_checkout_id: checkout.id })
        .eq("id", bid.id);
    }
    console.log("Polar checkout", bid.id, input.zoneName, input.amount, checkout.id);
    return NextResponse.json({
      bid_id: bid.id,
      amount_cents: input.amount,
      status: "pending",
      checkout_url: checkout.url,
    });
  } catch (error) {
    console.log("Polar checkout failed", error);
    await input.admin.from("bids").update({ status: "failed" }).eq("id", bid.id);
    return NextResponse.json(
      { error: "Checkout did not open. Try again." },
      { status: 502 },
    );
  }
}
