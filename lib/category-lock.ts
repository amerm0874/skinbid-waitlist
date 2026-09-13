import type { SupabaseClient } from "@supabase/supabase-js";

export async function categoryHoldsOtherZone(
  admin: SupabaseClient,
  eventId: string,
  zoneId: string,
  brandId: string,
  category: string | null,
) {
  const { data: eventZones } = await admin
    .from("zones")
    .select("id")
    .eq("event_id", eventId);
  const ids = (eventZones ?? []).map((row) => row.id);
  if (!ids.length) {
    return false;
  }
  const { data: categoryBids } = await admin
    .from("bids")
    .select("brand_id, zone_id")
    .in("zone_id", ids)
    .in("status", ["held", "won"]);
  const other = (categoryBids ?? []).filter((bid) => bid.zone_id !== zoneId);
  if (!other.length) {
    return false;
  }
  // Same brand cannot take a second zone on this event.
  if (other.some((bid) => bid.brand_id === brandId)) {
    return true;
  }
  if (!category) {
    return false;
  }
  const brandIds = [...new Set(other.map((row) => row.brand_id))];
  const { data: brands } = await admin
    .from("profiles")
    .select("id, brand_category")
    .in("id", brandIds);
  const sameCategory = new Set(
    (brands ?? [])
      .filter((row) => row.brand_category && row.brand_category === category)
      .map((row) => row.id),
  );
  return other.some((bid) => sameCategory.has(bid.brand_id));
}
