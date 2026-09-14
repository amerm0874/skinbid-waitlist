import { revalidatePath } from "next/cache";
import { isAuctionClosed } from "@/lib/auction";
import { categoryHoldsOtherZone } from "@/lib/category-lock";
import { closeEventAuction, refundHeldOnZone } from "@/lib/close-auctions";
import { notifyHeldBid } from "@/lib/email";
import { nextBidCents } from "@/lib/money";
import { captureServerEvent } from "@/lib/posthog-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  bidIdFromMetadata,
  createWhopClient,
  describeWhopError,
  refundWhopPayment,
  resolveWhopCompanyId,
} from "@/lib/whop";
import { isPersistedZoneId } from "@/lib/zone-bids";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

type BidRow = {
  id: string;
  zone_id: string;
  brand_id: string;
  amount_cents: number;
  status: string;
};

type PaidPayment = {
  id: string;
  checkout_configuration_id: string | null;
  metadata: Record<string, unknown> | null;
  total: { amount: string } | null;
  refunded_at: string | null;
  auto_refunded: boolean;
  status: string | null;
  paid_at: string | number | null;
};

export async function holdPaidBid(input: {
  bidId: string | null;
  checkoutId: string | null;
  paymentId: string;
  paidCents: number;
  revalidate?: boolean;
}) {
  const admin = createAdminSupabase();
  if (!admin) {
    return false;
  }

  const bid = await findBid(admin, input);
  if (!bid) {
    console.log("Whop paid — no bid row", input.paymentId, input.bidId);
    return false;
  }
  if (bid.status === "held" || bid.status === "won") {
    return true;
  }
  if (bid.status !== "pending") {
    console.log("Whop paid — bid not pending", bid.id, bid.status);
    await refundWhopPayment(input.paymentId).catch((error) => {
      console.log("Whop leftover refund failed", bid.id, error);
    });
    return false;
  }

  const { data: zone } = await admin
    .from("zones")
    .select("id, name, event_id, status")
    .eq("id", bid.zone_id)
    .maybeSingle();
  if (!zone || zone.status !== "open") {
    await rejectPaidBid(admin, bid.id, input.paymentId, "Zone is closed.");
    return false;
  }

  const { data: event } = await admin
    .from("events")
    .select("id, slug, date, status, athlete_id")
    .eq("id", zone.event_id)
    .maybeSingle();
  if (!event || event.status !== "live") {
    await rejectPaidBid(admin, bid.id, input.paymentId, "Event is not live.");
    return false;
  }
  if (isAuctionClosed(event.date)) {
    await closeEventAuction(event.id);
    await rejectPaidBid(admin, bid.id, input.paymentId, "Auction is closed.");
    return false;
  }

  const { data: brand } = await admin
    .from("profiles")
    .select("brand_category")
    .eq("id", bid.brand_id)
    .maybeSingle();
  const locked = await categoryHoldsOtherZone(
    admin,
    event.id,
    zone.id,
    bid.brand_id,
    brand?.brand_category ?? null,
  );
  if (locked) {
    await rejectPaidBid(
      admin,
      bid.id,
      input.paymentId,
      "This category already holds a zone on this event.",
    );
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
      input.paymentId,
      `Next bid is ${needed / 100} USD.`,
    );
    return false;
  }

  await admin
    .from("bids")
    .update({
      status: "held",
      whop_payment_id: input.paymentId,
      whop_checkout_id: input.checkoutId,
    })
    .eq("id", bid.id)
    .eq("status", "pending");

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
  if (input.revalidate !== false && event.slug) {
    revalidatePath(`/e/${event.slug}`);
    revalidatePath(`/e/${event.slug}/logo`);
    revalidatePath("/e/[slug]", "page");
  }
  console.log("Whop bid held", bid.id, bid.amount_cents, input.paymentId);
  await captureServerEvent({
    distinctId: bid.brand_id,
    event: "bid_held",
    properties: {
      slug: event.slug,
      zone: zone.name,
      amount_cents: bid.amount_cents,
      bid_id: bid.id,
    },
  });
  return true;
}

export async function holdReturnedBid(input: {
  bidId: string;
  brandId: string;
  paymentId?: string | null;
}) {
  const bidId = input.bidId.trim();
  if (!bidId) {
    return false;
  }
  const admin = createAdminSupabase();
  if (!admin) {
    return false;
  }

  const bid = await findBid(admin, { bidId });
  if (!bid || bid.brand_id !== input.brandId) {
    return false;
  }
  if (bid.status === "held" || bid.status === "won") {
    return true;
  }
  if (bid.status !== "pending") {
    return false;
  }

  const { data: row } = await admin
    .from("bids")
    .select("whop_checkout_id")
    .eq("id", bid.id)
    .maybeSingle();
  const checkoutId = row?.whop_checkout_id ?? null;
  const payment = await findSucceededWhopPayment({
    bidId: bid.id,
    checkoutId,
    paymentId: input.paymentId ?? null,
  });
  if (!payment) {
    console.log("Whop return — no paid payment", bid.id);
    return false;
  }
  return holdPaidBid({
    bidId: bid.id,
    checkoutId: payment.checkout_configuration_id ?? checkoutId,
    paymentId: payment.id,
    paidCents: paidCentsOf(payment),
  });
}

export async function holdPaidPendingBids(zoneIds: string[]) {
  const unique = [...new Set(zoneIds.filter(isPersistedZoneId))];
  if (!unique.length) {
    return false;
  }
  const admin = createAdminSupabase();
  if (!admin) {
    return false;
  }

  const { data: pending } = await admin
    .from("bids")
    .select("id, whop_checkout_id, created_at")
    .in("zone_id", unique)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (!pending?.length) {
    return false;
  }

  const paid = await listSucceededWhopPayments();
  if (!paid.length) {
    return false;
  }

  let heldAny = false;
  for (const bid of pending) {
    const payment = matchPayment(paid, bid.id, bid.whop_checkout_id);
    if (!payment) {
      continue;
    }
    const held = await holdPaidBid({
      bidId: bid.id,
      checkoutId: payment.checkout_configuration_id,
      paymentId: payment.id,
      paidCents: paidCentsOf(payment),
      revalidate: false,
    });
    if (held) {
      heldAny = true;
    }
  }
  return heldAny;
}

export async function findBid(
  admin: Admin,
  input: { bidId?: string | null; checkoutId?: string | null },
): Promise<BidRow | null> {
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
  const { data } = await admin
    .from("bids")
    .select("id, zone_id, brand_id, amount_cents, status")
    .eq("whop_checkout_id", input.checkoutId)
    .maybeSingle();
  return data ?? null;
}

async function rejectPaidBid(
  admin: Admin,
  bidId: string,
  paymentId: string,
  reason: string,
) {
  console.log("Whop bid rejected", bidId, reason);
  await admin.from("bids").update({ status: "failed" }).eq("id", bidId);
  try {
    await refundWhopPayment(paymentId);
  } catch (error) {
    console.log("Whop reject refund failed", bidId, error);
  }
}

function paidCentsOf(payment: PaidPayment) {
  return Math.round(Number(payment.total?.amount ?? "0") * 100);
}

function isSucceededPayment(payment: PaidPayment) {
  if (payment.refunded_at || payment.auto_refunded) {
    return false;
  }
  if (payment.status === "paid" || payment.status === "pending") {
    return true;
  }
  return Boolean(payment.paid_at);
}

function matchesBid(
  payment: PaidPayment,
  bidId: string,
  checkoutId: string | null,
) {
  if (bidIdFromMetadata(payment.metadata) === bidId) {
    return true;
  }
  return Boolean(checkoutId && payment.checkout_configuration_id === checkoutId);
}

function matchPayment(
  payments: PaidPayment[],
  bidId: string,
  checkoutId: string | null,
) {
  return (
    payments.find(
      (payment) => isSucceededPayment(payment) && matchesBid(payment, bidId, checkoutId),
    ) ?? null
  );
}

function asPaidPayment(row: {
  id?: string;
  checkout_configuration_id?: string | null;
  metadata?: Record<string, unknown> | null;
  total?: { amount: string } | number | null;
  refunded_at?: string | null;
  auto_refunded?: boolean;
  status?: string | null;
  paid_at?: string | number | null;
}): PaidPayment | null {
  if (!row.id) {
    return null;
  }
  const total =
    typeof row.total === "number"
      ? { amount: String(row.total) }
      : row.total ?? null;
  return {
    id: row.id,
    checkout_configuration_id: row.checkout_configuration_id ?? null,
    metadata: row.metadata ?? null,
    total,
    refunded_at: row.refunded_at ?? null,
    auto_refunded: Boolean(row.auto_refunded),
    status: row.status ?? null,
    paid_at: row.paid_at ?? null,
  };
}

async function findSucceededWhopPayment(input: {
  bidId: string;
  checkoutId: string | null;
  paymentId?: string | null;
}) {
  const paymentId = input.paymentId?.trim() ?? "";
  if (paymentId.startsWith("pay_")) {
    const retrieved = await retrieveWhopPayment(paymentId);
    if (retrieved && isSucceededPayment(retrieved)) {
      const metaBid = bidIdFromMetadata(retrieved.metadata);
      if (!metaBid || metaBid === input.bidId) {
        return retrieved;
      }
    }
  }
  return matchPayment(
    await listSucceededWhopPayments(),
    input.bidId,
    input.checkoutId,
  );
}

async function retrieveWhopPayment(paymentId: string) {
  const whop = createWhopClient();
  if (!whop) {
    return null;
  }
  try {
    return asPaidPayment(await whop.payments.retrieve({ id: paymentId }));
  } catch (error) {
    console.log(
      "Whop payment retrieve failed",
      paymentId,
      describeWhopError(error).message,
    );
    return null;
  }
}

async function listSucceededWhopPayments() {
  const paid = await listWhopPayments("paid");
  const pending = await listWhopPayments("pending");
  const extra = paid.length || pending.length ? [] : await listWhopPayments();
  const seen = new Set<string>();
  const payments: PaidPayment[] = [];
  for (const payment of [...paid, ...pending, ...extra]) {
    if (seen.has(payment.id)) {
      continue;
    }
    seen.add(payment.id);
    payments.push(payment);
  }
  return payments;
}

async function listWhopPayments(status?: "paid" | "pending") {
  const whop = createWhopClient();
  const companyId = resolveWhopCompanyId();
  if (!whop || !companyId) {
    return [];
  }
  try {
    const page = await whop.payments.list({
      account_id: companyId,
      ...(status ? { status } : {}),
      first: 50,
    });
    return (page.data ?? [])
      .map((row) => asPaidPayment(row))
      .filter((row): row is PaidPayment => Boolean(row));
  } catch (error) {
    console.log(
      "Whop paid list failed",
      status ?? "any",
      describeWhopError(error).message,
    );
    return [];
  }
}
