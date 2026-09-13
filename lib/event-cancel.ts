import type { createServerSupabase } from "@/lib/supabase/server";
import { HELD_OR_WON } from "@/lib/zone-status";

type Db = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

export const CANCEL_BLOCKED = "Cancel is blocked after a bid.";

export async function eventHasHeldOrWonBid(supabase: Db, eventId: string) {
  const { data: zones } = await supabase
    .from("zones")
    .select("id")
    .eq("event_id", eventId);
  const zoneIds = (zones ?? []).map((zone) => zone.id);
  if (zoneIds.length === 0) {
    return false;
  }

  const { data: bids } = await supabase
    .from("bids")
    .select("id")
    .in("zone_id", zoneIds)
    .in("status", [...HELD_OR_WON])
    .limit(1);

  return Boolean(bids?.length);
}
