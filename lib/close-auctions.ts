import { AUCTION_CLOSE_HOURS } from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { refundDodoPayment } from "@/lib/dodo";

export async function closeDueAuctions(now = new Date()) {
  const admin = createAdminSupabase();
  if (!admin) {
    return { closed: 0, won: 0, refunded: 0, error: "No service role key" };
  }

  const closeBefore = new Date(
    now.getTime() + AUCTION_CLOSE_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: dueEvents, error } = await admin
    .from("events")
    .select("id, date")
    .eq("status", "live")
    .lte("date", closeBefore);

  if (error) {
    throw error;
  }

  let won = 0;
  let refunded = 0;

  for (const event of dueEvents ?? []) {
    const { data: zones } = await admin
      .from("zones")
      .select("id")
      .eq("event_id", event.id);

    for (const zone of zones ?? []) {
      const { data: held } = await admin
        .from("bids")
        .select("id, amount_cents, dodo_payment_id")
        .eq("zone_id", zone.id)
        .eq("status", "held")
        .order("amount_cents", { ascending: false });

      if (!held || held.length === 0) {
        continue;
      }

      const [leader, ...losers] = held;
      await admin.from("bids").update({ status: "won" }).eq("id", leader.id);
      won += 1;

      for (const loser of losers) {
        if (loser.dodo_payment_id) {
          await refundDodoPayment(loser.dodo_payment_id, "Outbid at auction close");
        }
        await admin.from("bids").update({ status: "refunded" }).eq("id", loser.id);
        refunded += 1;
      }
    }

    await admin.from("events").update({ status: "closed" }).eq("id", event.id);
  }

  console.log("Auction close job", {
    closed: dueEvents?.length ?? 0,
    won,
    refunded,
  });

  return { closed: dueEvents?.length ?? 0, won, refunded };
}

export async function refundHeldOnZone(
  zoneId: string,
  exceptBidId?: string,
) {
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }

  let query = admin
    .from("bids")
    .select("id, dodo_payment_id")
    .eq("zone_id", zoneId)
    .eq("status", "held");

  const { data: held } = await query;

  for (const bid of held ?? []) {
    if (exceptBidId && bid.id === exceptBidId) {
      continue;
    }
    if (bid.dodo_payment_id) {
      await refundDodoPayment(bid.dodo_payment_id, "Outbid");
    }
    await admin.from("bids").update({ status: "refunded" }).eq("id", bid.id);
  }
}
