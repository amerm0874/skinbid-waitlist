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

export function parseEventStart(iso: string | null | undefined) {
  const raw = iso?.trim() ?? "";
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEventStartLabel(iso: string | null | undefined) {
  const start = parseEventStart(iso);
  if (!start) {
    return iso?.trim() || "—";
  }
  return start.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAuctionRemain(remainMs: number) {
  const remain = Math.max(0, remainMs);
  const days = Math.floor(remain / 86_400_000);
  const hours = Math.floor((remain % 86_400_000) / 3_600_000);
  const mins = Math.floor((remain % 3_600_000) / 60_000);
  const secs = Math.floor((remain % 60_000) / 1000);
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

export type ClockPart = { n: number; u: string };

function splitRemain(remainMs: number) {
  const remain = Math.max(0, remainMs);
  return {
    days: Math.floor(remain / 86_400_000),
    hours: Math.floor((remain % 86_400_000) / 3_600_000),
    mins: Math.floor((remain % 3_600_000) / 60_000),
    secs: Math.floor((remain % 60_000) / 1000),
  };
}

// Close clock: event start minus 48h. Not a fake days-out.
export function countdownParts(eventDateIso: string, now: number): ClockPart[] {
  const close = auctionClosesAt(eventDateIso);
  const remain = Number.isNaN(close.getTime())
    ? 0
    : Math.max(0, close.getTime() - now);
  const { days, hours, mins, secs } = splitRemain(remain);
  const parts = days > 0 ? [{ n: days, u: "d" }] : [];
  parts.push(
    { n: hours, u: "h" },
    { n: mins, u: "m" },
    { n: secs, u: "s" },
  );
  return parts;
}

export function auctionClosesAt(eventDateIso: string) {
  const start = parseEventStart(eventDateIso);
  if (!start) {
    return new Date(Number.NaN);
  }
  return new Date(start.getTime() - AUCTION_CLOSE_HOURS * 60 * 60 * 1000);
}

export function isAuctionOpen(eventDateIso: string, now = new Date()) {
  return !isAuctionClosed(eventDateIso, now);
}

// Close bidding when now > event_start - 48 hours.
export function isAuctionClosed(eventDateIso: string, now = new Date()) {
  const close = auctionClosesAt(eventDateIso);
  if (Number.isNaN(close.getTime())) {
    return false;
  }
  return now.getTime() > close.getTime();
}

export type AuctionClockKind = "demo" | "date" | "pending" | "closed" | "countdown";

export function auctionClockView(
  eventDateIso: string | null | undefined,
  now: number | null,
  options?: { demo?: boolean },
): { kind: AuctionClockKind; label: string } {
  if (options?.demo) {
    return { kind: "demo", label: "Demo" };
  }
  const start = parseEventStart(eventDateIso);
  if (!start) {
    return { kind: "date", label: formatEventStartLabel(eventDateIso) };
  }
  if (now == null) {
    return { kind: "pending", label: "—" };
  }
  const remain = auctionClosesAt(eventDateIso ?? "").getTime() - now;
  if (remain <= 0) {
    return { kind: "closed", label: "Closed" };
  }
  return { kind: "countdown", label: formatAuctionRemain(remain) };
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
  "athletes",
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
