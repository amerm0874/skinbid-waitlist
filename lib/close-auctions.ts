import { revalidatePath } from "next/cache";
import { AUCTION_CLOSE_HOURS } from "@/lib/config";
import { isMissingColumn } from "@/lib/db-error";
import {
  notifyAuctionWon,
  notifyRefundDone,
  sendProofDueReminders,
} from "@/lib/email";
import { refundWhopPayment, whopPaymentsEnabled } from "@/lib/whop";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

export async function closeDueAuctions(now = new Date()) {
  const admin = createAdminSupabase();
  if (!admin) {
    return { closed: 0, won: 0, failed: 0, error: "No service role key" };
  }

  const closeBefore = new Date(
    now.getTime() + AUCTION_CLOSE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: dueEvents, error } = await admin
    .from("events")
    .select("id, slug")
    .eq("status", "live")
    .lte("date", closeBefore);

  if (error) {
    throw error;
  }

  let won = 0;
  let failed = 0;

  for (const event of dueEvents ?? []) {
    const result = await settleEvent(admin, event.id);
    won += result.won;
    failed += result.failed;
    if (event.slug) {
      revalidatePath(`/e/${event.slug}`);
    }
  }

  const proofDue = await sendProofDueReminders(now);

  console.log("Auction close job", {
    closed: dueEvents?.length ?? 0,
    won,
    failed,
    proofDue: proofDue.sent,
  });

  return { closed: dueEvents?.length ?? 0, won, failed, proofDue: proofDue.sent };
}

// Used by /e/[slug] so close does not wait on cron.
export async function closeEventAuction(eventId: string) {
  const admin = createAdminSupabase();
  if (!admin) {
    return { won: 0, failed: 0, error: "No service role key" as const };
  }
  return settleEvent(admin, eventId);
}

async function settleEvent(admin: Admin, eventId: string) {
  const { data: event } = await admin
    .from("events")
    .select("id, slug, name, athlete_id")
    .eq("id", eventId)
    .maybeSingle();

  const { data: zones } = await admin
    .from("zones")
    .select("id, name")
    .eq("event_id", eventId);

  let won = 0;
  let failed = 0;

  for (const zone of zones ?? []) {
    const { data: held } = await admin
      .from("bids")
      .select("id, amount_cents, brand_id, created_at")
      .eq("zone_id", zone.id)
      .eq("status", "held")
      .order("amount_cents", { ascending: false })
      .order("created_at", { ascending: true });

    if (!held || held.length === 0) {
      continue;
    }

    const [leader, ...losers] = held;
    await admin.from("bids").update({ status: "won" }).eq("id", leader.id);
    won += 1;

    if (event) {
      await notifyAuctionWon({
        bidId: leader.id,
        athleteId: event.athlete_id,
        brandId: leader.brand_id,
        zoneName: zone.name,
        amountCents: leader.amount_cents,
        eventSlug: event.slug,
      });
    }

    if (losers.length) {
      failed += losers.length;
    }
    await refundHeldOnZone(zone.id, leader.id);
  }

  await admin.from("events").update({ status: "closed" }).eq("id", eventId);
  return { won, failed };
}

// Flip previous held bids on a zone to refunded.
export async function refundHeldOnZone(
  zoneId: string,
  exceptBidId?: string,
  options?: { refundPayment?: boolean },
) {
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }

  const refundPayment = options?.refundPayment !== false && whopPaymentsEnabled();
  const { data: zone } = await admin
    .from("zones")
    .select("id, name, event_id")
    .eq("id", zoneId)
    .maybeSingle();
  const { data: event } = zone
    ? await admin.from("events").select("slug").eq("id", zone.event_id).maybeSingle()
    : { data: null };
  const { data: held } = await admin
    .from("bids")
    .select("id, brand_id, amount_cents, whop_payment_id")
    .eq("zone_id", zoneId)
    .eq("status", "held");

  for (const bid of held ?? []) {
    if (exceptBidId && bid.id === exceptBidId) {
      continue;
    }
    if (refundPayment && bid.whop_payment_id) {
      try {
        await refundWhopPayment(bid.whop_payment_id);
      } catch (error) {
        console.log("Whop outbid refund failed", bid.id, error);
      }
    }
    await refundHeldBid(admin, bid.id);
    if (event?.slug && zone) {
      await notifyRefundDone({
        bidId: bid.id,
        brandId: bid.brand_id,
        zoneName: zone.name,
        amountCents: bid.amount_cents,
        eventSlug: event.slug,
      });
    }
  }
}

async function refundHeldBid(admin: Admin, bidId: string) {
  let payload: Record<string, unknown> = {
    status: "refunded",
    payable: false,
    logo_url: null,
    mark_kind: null,
    post_rules: null,
  };
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
    console.log("Outbid refund failed", bidId, error.message);
  }
}
