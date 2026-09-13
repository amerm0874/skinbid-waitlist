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
  dodo_payment_id: string | null;
  dodo_checkout_id: string | null;
  polar_checkout_id: string | null;
  polar_order_id: string | null;
  status: BidStatus;
  payable: boolean;
};

export type ProofRow = {
  id: string;
  event_id: string;
  files: string[];
  post_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};
