import {
  AUCTION_CLOSE_HOURS,
  EVENT_MAX_DAYS,
  EVENT_MIN_DAYS,
} from "@/lib/config";

export function eventDateWindowError(dateIso: string, now = new Date()) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "Enter a real event date.";
  }

  const min = new Date(now);
  min.setDate(min.getDate() + EVENT_MIN_DAYS);
  min.setHours(0, 0, 0, 0);

  const max = new Date(now);
  max.setDate(max.getDate() + EVENT_MAX_DAYS);
  max.setHours(23, 59, 59, 999);

  if (date < min) {
    return `Event must be at least ${EVENT_MIN_DAYS} days out.`;
  }
  if (date > max) {
    return `Event must be within ${EVENT_MAX_DAYS} days.`;
  }
  return null;
}

export function auctionClosesAt(eventDateIso: string) {
  const close = new Date(eventDateIso);
  close.setHours(close.getHours() - AUCTION_CLOSE_HOURS);
  return close;
}

export function isAuctionOpen(eventDateIso: string, now = new Date()) {
  return now < auctionClosesAt(eventDateIso);
}

export function slugify(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "event"}-${suffix}`;
}
