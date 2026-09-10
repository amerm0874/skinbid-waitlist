import { NextResponse } from "next/server";
import { isAuctionOpen } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { createDodo } from "@/lib/dodo";
import { BID_STEP_CENTS, FLOOR_CENTS } from "@/lib/config";
import { nextBidCents } from "@/lib/money";
import { DEMO_SLUG } from "@/lib/demo-event";

type Body = {
  slug?: string;
  zone_id?: string;
  zone_name?: string;
  amount_cents?: number;
};

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  const body = (await request.json()) as Body;
  const amount = Number(body.amount_cents);
  const origin = new URL(request.url).origin;

  if (!user || !profile) {
    return NextResponse.json({ error: "Log in as a brand." }, { status: 401 });
  }
  if (profile.role !== "brand") {
    return NextResponse.json({ error: "Only brands bid." }, { status: 403 });
  }
  if (!Number.isFinite(amount) || amount < FLOOR_CENTS) {
    return NextResponse.json({ error: "Floor is $100." }, { status: 400 });
  }

  const dodo = createDodo();
  const productId = process.env.DODO_BID_PRODUCT_ID;
  if (!dodo || !productId) {
    return NextResponse.json(
      { error: "Dodo is not configured. Add DODO_PAYMENTS_API_KEY and DODO_BID_PRODUCT_ID." },
      { status: 503 },
    );
  }

  let zoneId = body.zone_id ?? "";
  let eventId = "";
  let athleteId = "";

  if (supabase && body.slug && body.slug !== DEMO_SLUG) {
    const { data: event } = await supabase
      .from("events")
      .select("id, athlete_id, date, status")
      .eq("slug", body.slug)
      .maybeSingle();
    if (!event || event.status !== "live") {
      return NextResponse.json({ error: "Event is not live." }, { status: 400 });
    }
    if (!isAuctionOpen(event.date)) {
      return NextResponse.json({ error: "Auction is closed." }, { status: 400 });
    }
    eventId = event.id;
    athleteId = event.athlete_id;

    const { data: zone } = await supabase
      .from("zones")
      .select("id, status")
      .eq("id", zoneId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!zone || zone.status !== "open") {
      return NextResponse.json({ error: "Zone is closed." }, { status: 400 });
    }

    const { data: held } = await supabase
      .from("bids")
      .select("amount_cents")
      .eq("zone_id", zone.id)
      .eq("status", "held")
      .order("amount_cents", { ascending: false })
      .limit(1)
      .maybeSingle();
    const min = nextBidCents(held?.amount_cents ?? null);
    if (amount < min || (amount - (held?.amount_cents ?? 0)) % BID_STEP_CENTS !== 0 && held) {
      if (amount < min) {
        return NextResponse.json({ error: `Next bid is ${min / 100} USD.` }, { status: 400 });
      }
    }

    if (profile.brand_category) {
      const { data: eventZones } = await supabase
        .from("zones")
        .select("id")
        .eq("event_id", event.id);
      const ids = (eventZones ?? []).map((row) => row.id);
      const { data: categoryBids } = await supabase
        .from("bids")
        .select("id, brand_id, zone_id")
        .in("zone_id", ids)
        .in("status", ["held", "won"]);
      const brandIds = [...new Set((categoryBids ?? []).map((row) => row.brand_id))];
      if (brandIds.length) {
        const { data: brands } = await supabase
          .from("profiles")
          .select("id, brand_category")
          .in("id", brandIds);
        const sameCategory = (brands ?? []).filter(
          (row) =>
            row.brand_category &&
            row.brand_category === profile.brand_category,
        );
        const takenBySameCategory = sameCategory.some((row) =>
          (categoryBids ?? []).some(
            (bid) => bid.brand_id === row.id && bid.zone_id !== zone.id,
          ),
        );
        if (takenBySameCategory) {
          return NextResponse.json(
            { error: "This category already holds a zone on this event." },
            { status: 400 },
          );
        }
      }
    }
  }

  const demoBid = !supabase || zoneId.startsWith("demo-") || !zoneId;
  let bidId = crypto.randomUUID();

  if (!demoBid && supabase) {
    const { data: bid, error: bidError } = await supabase
      .from("bids")
      .insert({
        zone_id: zoneId,
        brand_id: user.id,
        amount_cents: amount,
        status: "pending",
      })
      .select("id")
      .single();
    if (bidError || !bid) {
      console.log("Bid insert failed", bidError?.message);
      return NextResponse.json({ error: "Could not place the bid." }, { status: 500 });
    }
    bidId = bid.id;
  }

  const session = await dodo.checkoutSessions.create({
    product_cart: [
      {
        product_id: productId,
        quantity: 1,
        amount,
      },
    ],
    customer: {
      email: user.email ?? "brand@skinbid.com",
      name: profile.name ?? "Brand",
    },
    return_url: `${origin}/e/${body.slug ?? "demo"}`,
    metadata: {
      bid_id: bidId,
      zone_id: zoneId,
      brand_id: user.id,
      event_id: eventId,
      athlete_id: athleteId,
    },
  });

  if (supabase && !demoBid && session.session_id) {
    await supabase
      .from("bids")
      .update({ dodo_checkout_id: session.session_id })
      .eq("id", bidId);
  }

  console.log("Dodo checkout created", bidId);
  return NextResponse.json({ checkout_url: session.checkout_url, bid_id: bidId });
}
