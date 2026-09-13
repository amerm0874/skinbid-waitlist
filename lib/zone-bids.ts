import type { SupabaseClient } from "@supabase/supabase-js";
import type { BidStatus } from "@/lib/types";

export type ZoneBidItem = {
  id: string;
  brandName: string;
  amountCents: number;
  createdAt: string;
  status: BidStatus;
};

const BID_STATUSES: BidStatus[] = [
  "pending",
  "held",
  "refunded",
  "won",
  "failed",
];

function isBidStatus(value: string): value is BidStatus {
  return BID_STATUSES.includes(value as BidStatus);
}

export function isPersistedZoneId(id: string) {
  return Boolean(id) && !id.startsWith("demo-") && !id.startsWith("missing-");
}

type BidRow = {
  id: string;
  zone_id?: string;
  amount_cents: number;
  status: string;
  created_at: string;
  brand_id: string;
};

function toItems(
  bids: BidRow[],
  names: Map<string, string>,
): ZoneBidItem[] {
  return bids.map((bid) => ({
    id: bid.id,
    brandName: names.get(bid.brand_id) ?? "Brand",
    amountCents: bid.amount_cents,
    createdAt: bid.created_at,
    status: isBidStatus(bid.status) ? bid.status : "pending",
  }));
}

async function brandNames(db: SupabaseClient, brandIds: string[]) {
  const unique = [...new Set(brandIds.filter(Boolean))];
  if (!unique.length) {
    return new Map<string, string>();
  }
  const { data } = await db.from("profiles").select("id, name").in("id", unique);
  return new Map(
    (data ?? []).map((row) => [
      row.id as string,
      (row.name as string | null)?.trim() || "Brand",
    ]),
  );
}

export async function loadLastZoneBids(
  db: SupabaseClient,
  zoneId: string,
  limit = 10,
): Promise<ZoneBidItem[]> {
  if (!isPersistedZoneId(zoneId)) {
    return [];
  }
  const { data } = await db
    .from("bids")
    .select("id, amount_cents, status, created_at, brand_id")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const bids = (data ?? []) as BidRow[];
  if (!bids.length) {
    return [];
  }
  return toItems(bids, await brandNames(db, bids.map((bid) => bid.brand_id)));
}

export async function loadLeadCentsByZone(
  db: SupabaseClient,
  zoneIds: string[],
) {
  const unique = [...new Set(zoneIds.filter(Boolean))];
  const leads = new Map<string, number>();
  if (!unique.length) {
    return leads;
  }
  const { data } = await db
    .from("bids")
    .select("zone_id, amount_cents, status")
    .in("zone_id", unique)
    .in("status", ["held", "won"]);
  for (const bid of data ?? []) {
    const current = leads.get(bid.zone_id) ?? 0;
    if (bid.amount_cents > current) {
      leads.set(bid.zone_id, bid.amount_cents);
    }
  }
  return leads;
}

export async function loadLastBidsByZone(
  db: SupabaseClient,
  zoneIds: string[],
): Promise<Record<string, ZoneBidItem[]>> {
  const unique = [...new Set(zoneIds.filter(isPersistedZoneId))];
  if (!unique.length) {
    return {};
  }
  const lists = await Promise.all(
    unique.map(async (id) => [id, await loadLastZoneBids(db, id)] as const),
  );
  return Object.fromEntries(lists);
}
