// Mirrors the web app's lib/types.ts — same Supabase schema, same shapes.

export type BidStatus = "pending" | "held" | "refunded" | "won" | "failed";
export type EventStatus = "draft" | "live" | "closed" | "done" | "cancelled";
export type ZoneStatus = "open" | "closed";
export type PublishedEventStatus = "live" | "closed" | "done";

export const PUBLISHED_EVENT_STATUSES: PublishedEventStatus[] = [
  "live",
  "closed",
  "done",
];

export function isPublishedEventStatus(
  status: string | null | undefined,
): status is PublishedEventStatus {
  return status === "live" || status === "closed" || status === "done";
}

export type Profile = {
  id: string;
  role: "athlete" | "brand";
  name: string | null;
  country: string | null;
  dob: string | null;
  age: number | null;
  gender?: string | null;
  sport: string | null;
  sport_detail?: string | null;
  social: string | null;
  socials?: { network: string; handle: string }[] | null;
  brand_category: string | null;
  website: string | null;
  logo_url: string | null;
  photo_url: string | null;
  payout_rail: string | null;
  payout_account: string | null;
};

export type EventRow = {
  id: string;
  athlete_id: string;
  name: string;
  date: string;
  city: string | null;
  sport: string | null;
  sport_detail?: string | null;
  slug: string;
  status: EventStatus;
  likeness_opt_in: boolean;
  appearance_price_cents: number | null;
  offer_tattoo?: boolean;
  offer_sticker?: boolean;
};

export type ZoneRow = {
  id: string;
  event_id: string;
  name: string;
  status: ZoneStatus;
};

export type BidRow = {
  id: string;
  zone_id: string;
  brand_id: string;
  amount_cents: number;
  whop_checkout_id: string | null;
  whop_payment_id: string | null;
  status: BidStatus;
  payable: boolean;
  logo_url?: string | null;
  mark_kind?: "tattoo" | "sticker" | null;
  post_rules?: string | null;
  created_at: string;
};

export type CaptureRow = {
  id: string;
  athlete_id: string;
  paths: string[];
  status: "pending" | "uploaded" | "processing" | "ready" | "failed";
  model_paid: boolean;
  whop_payment_id: string | null;
  created_at: string;
};

export type ProofRow = {
  id: string;
  event_id: string;
  files: string[];
  post_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type NoticeKind =
  | "bid_held"
  | "bid_held_brand"
  | "outbid"
  | "won"
  | "auction_won_athlete"
  | "auction_won_brand"
  | "proof_due"
  | "proof_approved"
  | "proof_rejected"
  | "refund_done";

export type NoticeRow = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};
