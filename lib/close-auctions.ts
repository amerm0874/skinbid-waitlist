import { revalidatePath } from "next/cache";
import { AUCTION_CLOSE_HOURS } from "@/lib/config";
import { notifyAuctionClosed } from "@/lib/email";
import { polarPaymentsEnabled, refundPolarOrder } from "@/lib/polar";
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

  console.log("Auction close job", {
    closed: dueEvents?.length ?? 0,
    won,
    failed,
  });

  return { closed: dueEvents?.length ?? 0, won, failed };
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
      // T–48h athlete mail ("auction closed, print the mark") goes out here.
      // Event-morning mail is sendEventMorningReminders in lib/email.ts — cron later.
      await notifyAuctionClosed({
        bidId: leader.id,
        athleteId: event.athlete_id,
        brandId: leader.brand_id,
        zoneName: zone.name,
        amountCents: leader.amount_cents,
        eventSlug: event.slug,
        eventName: event.name,
      });
    }

    if (losers.length) {
      await admin
        .from("bids")
        .update({ status: "failed" })
        .in(
          "id",
          losers.map((row) => row.id),
        );
      failed += losers.length;
    }
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

  const refundPayment = options?.refundPayment !== false && polarPaymentsEnabled();
  type HeldRow = {
    id: string;
    amount_cents: number;
    polar_order_id?: string | null;
    dodo_payment_id?: string | null;
  };
  let held: HeldRow[] | null = null;
  const withPolar = await admin
    .from("bids")
    .select("id, amount_cents, polar_order_id, dodo_payment_id")
    .eq("zone_id", zoneId)
    .eq("status", "held");
  if (withPolar.error) {
    const fallback = await admin
      .from("bids")
      .select("id, amount_cents, dodo_payment_id")
      .eq("zone_id", zoneId)
      .eq("status", "held");
    held = fallback.data;
  } else {
    held = withPolar.data;
  }

  for (const bid of held ?? []) {
    if (exceptBidId && bid.id === exceptBidId) {
      continue;
    }
    const orderId =
      ("polar_order_id" in bid && typeof bid.polar_order_id === "string"
        ? bid.polar_order_id
        : null) || bid.dodo_payment_id;
    if (refundPayment && orderId) {
      try {
        await refundPolarOrder(orderId, bid.amount_cents);
      } catch (error) {
        console.log("Polar outbid refund failed", bid.id, error);
      }
    }
    await admin
      .from("bids")
      .update({ status: "refunded", payable: false })
      .eq("id", bid.id);
  }
}
