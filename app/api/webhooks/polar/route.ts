import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAuctionClosed } from "@/lib/auction";
import { closeEventAuction, refundHeldOnZone } from "@/lib/close-auctions";
import { notifyHeldBid } from "@/lib/email";
import { nextBidCents } from "@/lib/money";
import {
  bidIdFromMetadata,
  parsePolarWebhook,
  refundPolarOrder,
  WebhookVerificationError,
} from "@/lib/polar";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = parsePolarWebhook(rawBody, request);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.log("Polar webhook signature failed", error.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    throw error;
  }

  console.log("Polar webhook", event.type);

  if (event.type === "checkout.expired") {
    const checkoutId = event.data.id;
    const bidId = bidIdFromMetadata(event.data.metadata) ?? undefined;
    await failPendingBid({ bidId, checkoutId });
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "order.paid") {
    return NextResponse.json({ ok: true });
  }

  const order = event.data;
  const bidId = bidIdFromMetadata(order.metadata);
  const checkoutId = order.checkoutId;
  const held = await holdPaidBid({
    bidId,
    checkoutId,
    orderId: order.id,
    paidCents: order.totalAmount,
  });

  return NextResponse.json({ ok: true, held });
}

async function failPendingBid(input: { bidId?: string; checkoutId?: string | null }) {
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }
  const bid = await findBid(admin, input);
  if (!bid || bid.status !== "pending") {
    return;
  }
  await admin.from("bids").update({ status: "failed" }).eq("id", bid.id);
}

async function holdPaidBid(input: {
  bidId: string | null;
  checkoutId: string | null;
  orderId: string;
  paidCents: number;
}) {
  const admin = createAdminSupabase();
  if (!admin) {
    return false;
  }

  const bid = await findBid(admin, input);
  if (!bid) {
    console.log("Polar paid — no bid row", input.orderId, input.bidId);
    return false;
  }
  if (bid.status === "held" || bid.status === "won") {
    return true;
  }
  if (bid.status !== "pending") {
    console.log("Polar paid — bid not pending", bid.id, bid.status);
    await refundPolarOrder(input.orderId, input.paidCents).catch((error) => {
      console.log("Polar leftover refund failed", bid.id, error);
    });
    return false;
  }

  const { data: zone } = await admin
    .from("zones")
    .select("id, name, event_id, status")
    .eq("id", bid.zone_id)
    .maybeSingle();
  if (!zone || zone.status !== "open") {
    await rejectPaidBid(admin, bid.id, input.orderId, input.paidCents, "Zone is closed.");
    return false;
  }

  const { data: event } = await admin
    .from("events")
    .select("id, slug, date, status, athlete_id")
    .eq("id", zone.event_id)
    .maybeSingle();
  if (!event || event.status !== "live") {
    await rejectPaidBid(admin, bid.id, input.orderId, input.paidCents, "Event is not live.");
    return false;
  }
  if (isAuctionClosed(event.date)) {
    await closeEventAuction(event.id);
    await rejectPaidBid(admin, bid.id, input.orderId, input.paidCents, "Auction is closed.");
    return false;
  }

  const { data: currentHeld } = await admin
    .from("bids")
    .select("id, amount_cents, brand_id")
    .eq("zone_id", zone.id)
    .eq("status", "held")
    .neq("id", bid.id)
    .order("amount_cents", { ascending: false })
    .limit(1)
    .maybeSingle();
  const needed = nextBidCents(currentHeld?.amount_cents ?? null);
  if (bid.amount_cents < needed) {
    await rejectPaidBid(
      admin,
      bid.id,
      input.orderId,
      input.paidCents,
      `Next bid is ${needed / 100} USD.`,
    );
    return false;
  }

  const { error: holdError } = await admin
    .from("bids")
    .update({
      status: "held",
      polar_order_id: input.orderId,
      polar_checkout_id: input.checkoutId,
      dodo_payment_id: input.orderId,
      dodo_checkout_id: input.checkoutId,
    })
    .eq("id", bid.id)
    .eq("status", "pending");
  if (holdError) {
    console.log("Polar hold update failed", holdError.message);
    await admin
      .from("bids")
      .update({
        status: "held",
        dodo_payment_id: input.orderId,
        dodo_checkout_id: input.checkoutId,
      })
      .eq("id", bid.id)
      .eq("status", "pending");
  }

  await refundHeldOnZone(zone.id, bid.id);
  await notifyHeldBid({
    bidId: bid.id,
    athleteId: event.athlete_id,
    currentBrandId: bid.brand_id,
    zoneName: zone.name,
    amountCents: bid.amount_cents,
    eventSlug: event.slug,
    previousBid: currentHeld
      ? { id: currentHeld.id, brandId: currentHeld.brand_id }
      : null,
  });
  if (event.slug) {
    revalidatePath(`/e/${event.slug}`);
    revalidatePath("/e/[slug]", "page");
  }
  console.log("Polar bid held", bid.id, bid.amount_cents, input.orderId);
  return true;
}

async function rejectPaidBid(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  bidId: string,
  orderId: string,
  paidCents: number,
  reason: string,
) {
  console.log("Polar bid rejected", bidId, reason);
  await admin.from("bids").update({ status: "failed" }).eq("id", bidId);
  try {
    await refundPolarOrder(orderId, paidCents);
  } catch (error) {
    console.log("Polar reject refund failed", bidId, error);
  }
}

async function findBid(
  admin: NonNullable<ReturnType<typeof createAdminSupabase>>,
  input: { bidId?: string | null; checkoutId?: string | null },
) {
  if (input.bidId) {
    const { data } = await admin
      .from("bids")
      .select("id, zone_id, brand_id, amount_cents, status")
      .eq("id", input.bidId)
      .maybeSingle();
    if (data) {
      return data;
    }
  }
  if (!input.checkoutId) {
    return null;
  }
  const { data: byPolar } = await admin
    .from("bids")
    .select("id, zone_id, brand_id, amount_cents, status")
    .eq("polar_checkout_id", input.checkoutId)
    .maybeSingle();
  if (byPolar) {
    return byPolar;
  }
  const { data: byDodo } = await admin
    .from("bids")
    .select("id, zone_id, brand_id, amount_cents, status")
    .eq("dodo_checkout_id", input.checkoutId)
    .maybeSingle();
  return byDodo ?? null;
}
