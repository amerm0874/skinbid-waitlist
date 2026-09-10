export type BidStatus = "pending" | "held" | "refunded" | "won" | "failed";
export type EventStatus = "draft" | "live" | "closed" | "done" | "cancelled";
export type ZoneStatus = "open" | "closed";

export type Profile = {
  id: string;
  role: "athlete" | "brand";
  name: string | null;
  country: string | null;
  social: string | null;
  brand_category: string | null;
  website: string | null;
  logo_url: string | null;
};

export type EventRow = {
  id: string;
  athlete_id: string;
  name: string;
  date: string;
  city: string | null;
  sport: string | null;
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
  status: BidStatus;
  payable: boolean;
};

export type ProofRow = {
  id: string;
  event_id: string;
  files: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
};
