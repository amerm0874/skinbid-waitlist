export type Role = "athlete" | "brand";

export const SITE = {
  name: "SkinBid",
  title: "SkinBid — Event-day body slots",
  description:
    "List logo slots on your body for any event. Brands pay SkinBid. You wear a temp tattoo for one day. You get paid after we check the photos.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.skinbid.me",
  email: "skinbidme@gmail.com",
  ogHeadline: "Your next race already has ad space.",
};

// Public pages Google is allowed to list during waitlist-only launch.
export const PUBLIC_PATHS = [
  "/",
  "/waitlist",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
] as const;

// How many waitlist posts one IP can send in the window.
export const WAITLIST_RATE_LIMIT = 8;
export const WAITLIST_RATE_WINDOW_MS = 10 * 60 * 1000;

export const FLOOR_CENTS = 10_000;
export const BID_STEP_CENTS = 10_000;
export const ATHLETE_SHARE = 0.8;
export const PLATFORM_SHARE = 0.2;
export const AUCTION_CLOSE_HOURS = 48;
export const EVENT_MIN_DAYS = 4;
export const EVENT_MAX_DAYS = 90;

export const BRAND_BUDGETS = ["<$500", "$500–2k", "$2k+"] as const;
export type BrandBudget = (typeof BRAND_BUDGETS)[number];

export const BRAND_CATEGORIES = [
  "supplements",
  "apparel",
  "software",
  "drink",
  "wearable",
  "other",
] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];
