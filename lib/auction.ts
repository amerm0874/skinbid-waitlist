import {
  AUCTION_CLOSE_HOURS,
  EVENT_MAX_MONTHS,
  EVENT_MIN_DAYS,
} from "@/lib/config";

export const EVENT_DATE_WINDOW_COPY =
  "Date must be from 4 days to 12 months out.";

export function eventDateWindowError(dateIso: string, now = new Date()) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "Enter a real event date.";
  }

  const min = new Date(now);
  min.setDate(min.getDate() + EVENT_MIN_DAYS);
  min.setHours(0, 0, 0, 0);

  const max = new Date(now);
  max.setMonth(max.getMonth() + EVENT_MAX_MONTHS);
  max.setHours(23, 59, 59, 999);

  if (date < min || date > max) {
    return EVENT_DATE_WINDOW_COPY;
  }
  return null;
}

export function auctionClosesAt(eventDateIso: string) {
  const close = new Date(eventDateIso);
  close.setHours(close.getHours() - AUCTION_CLOSE_HOURS);
  return close;
}

export function isAuctionOpen(eventDateIso: string, now = new Date()) {
  return !isAuctionClosed(eventDateIso, now);
}

// Close bidding when now > event_start - 48 hours.
export function isAuctionClosed(eventDateIso: string, now = new Date()) {
  return now.getTime() > auctionClosesAt(eventDateIso).getTime();
}

// No end timestamp on the listing. Treat the start day's last millisecond as the end.
export function eventEndsAt(eventDateIso: string) {
  const start = new Date(eventDateIso);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  if (end.getTime() < start.getTime()) {
    return new Date(start.getTime() + 12 * 60 * 60 * 1000);
  }
  return end;
}

export function isEventOver(eventDateIso: string, now = new Date()) {
  return now.getTime() > eventEndsAt(eventDateIso).getTime();
}

const RESERVED_SLUGS = new Set([
  "demo",
  "new",
  "events",
  "login",
  "admin",
  "waitlist",
  "about",
  "privacy",
  "terms",
  "contact",
  "onboarding",
  "outreach",
  "inbox",
  "proof",
  "me",
  "api",
  "auth",
]);

export function normalizeEventSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function eventSlugError(input: string) {
  const slug = normalizeEventSlug(input);
  if (slug.length < 3) {
    return "Event link must be at least 3 characters.";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return "That URL is reserved.";
  }
  return null;
}

export function slugify(input: string) {
  const base = normalizeEventSlug(input);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "event"}-${suffix}`;
}
