import { auctionClosesAt } from "@/lib/auction";
import { nextBidCents } from "@/lib/money";

export type Gender = "male" | "female";

export type SlotId =
  | "chest-left"
  | "chest-right"
  | "shoulder-left"
  | "shoulder-right"
  | "biceps-left"
  | "biceps-right"
  | "abs"
  | "thigh-front-left"
  | "thigh-front-right"
  | "back-left"
  | "back-right"
  | "thigh-back-left"
  | "thigh-back-right";

// Names shown on the 3D card and the waitlist form.
export const SLOT_LABELS: Record<SlotId, string> = {
  "chest-left": "Left chest",
  "chest-right": "Right chest",
  "shoulder-left": "Left shoulder",
  "shoulder-right": "Right shoulder",
  "biceps-left": "Left biceps",
  "biceps-right": "Right biceps",
  abs: "Abs",
  "thigh-front-left": "Left thigh",
  "thigh-front-right": "Right thigh",
  "back-left": "Left back",
  "back-right": "Right back",
  "thigh-back-left": "Left hamstring",
  "thigh-back-right": "Right hamstring",
};

export function slotLabel(slot: string | undefined) {
  if (!slot) {
    return undefined;
  }
  if (slot in SLOT_LABELS) {
    return SLOT_LABELS[slot as SlotId];
  }
  return undefined;
}

export type DemoBid = {
  cents: number | null;
  brand: string | null;
};

export type DemoAthlete = {
  gender: Gender;
  name: string;
  fullName: string;
  sport: string;
  event: string;
  city: string;
  country: string;
  countryCode: string;
  flag: string;
  age: number;
  heightCm: number;
  weightKg: number;
  lastResult: string;
  eventHref: string;
  daysOut: number;
  social: string;
  followers: string;
  visitorsBase: number;
  watchedToday: number;
  photo: string;
  bids: Partial<Record<SlotId, DemoBid>>;
};

export type DemoWatcher = {
  country: string;
  code: string;
  flag: string;
  agoSec: number;
};

// Fake watch log for the preview HUD. Not live traffic.
export const DEMO_WATCHERS: DemoWatcher[] = [
  { country: "Portugal", code: "PT", flag: "🇵🇹", agoSec: 14 },
  { country: "Germany", code: "DE", flag: "🇩🇪", agoSec: 47 },
  { country: "United States", code: "US", flag: "🇺🇸", agoSec: 93 },
];

// Fake event pages for the waitlist 3D preview. Not real athletes. Not a live auction.
export const DEMO_ATHLETES: Record<Gender, DemoAthlete> = {
  male: {
    gender: "male",
    name: "A. RIVER",
    fullName: "Alex River",
    sport: "HYROX",
    event: "HYROX Lisbon",
    eventHref: "https://portugal.hyrox.com/event/hyrox-lisbon-season-25-26-tf2gvl",
    city: "Lisbon",
    country: "Portugal",
    countryCode: "PT",
    flag: "🇵🇹",
    age: 29,
    heightCm: 182,
    weightKg: 79,
    lastResult: "1:18:42 mixed",
    daysOut: 14,
    social: "@ariver",
    followers: "12.4k",
    visitorsBase: 18,
    watchedToday: 247,
    photo: "/poster-male.webp",
    bids: {
      "chest-left": { cents: 40000, brand: "Pulse" },
      "chest-right": { cents: 20000, brand: "Nomad" },
      "shoulder-right": { cents: 30000, brand: "Veil" },
      "biceps-right": { cents: 10000, brand: "Grid" },
      abs: { cents: 70000, brand: "Ration" },
      "thigh-front-right": { cents: 20000, brand: "Keel" },
      "back-left": { cents: 50000, brand: "Volt" },
      "thigh-back-right": { cents: 30000, brand: "Hearth" },
    },
  },
  female: {
    gender: "female",
    name: "M. COLE",
    fullName: "Maya Cole",
    sport: "HYROX",
    event: "HYROX Berlin",
    eventHref: "https://hyroxdach.com/de/event/hyrox-berlin/",
    city: "Berlin",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    age: 27,
    heightCm: 168,
    weightKg: 64,
    lastResult: "1:09:18 women",
    daysOut: 18,
    social: "@mcole",
    followers: "8.1k",
    visitorsBase: 14,
    watchedToday: 186,
    photo: "/poster-female.webp",
    bids: {
      "shoulder-left": { cents: 20000, brand: "Pulse" },
      "biceps-left": { cents: 40000, brand: "Nomad" },
      abs: { cents: 60000, brand: "Ration" },
      "thigh-front-left": { cents: 20000, brand: "Veil" },
      "back-right": { cents: 30000, brand: "Volt" },
      "thigh-back-left": { cents: 10000, brand: "Grid" },
    },
  },
};

export function demoEventDateIso(daysOut: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + daysOut);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

export function formatHudDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function remainMs(eventDateIso: string, now = Date.now()) {
  return Math.max(0, auctionClosesAt(eventDateIso).getTime() - now);
}

function splitRemain(remain: number) {
  return {
    days: Math.floor(remain / 86_400_000),
    hours: Math.floor((remain % 86_400_000) / 3_600_000),
    mins: Math.floor((remain % 3_600_000) / 60_000),
    secs: Math.floor((remain % 60_000) / 1000),
  };
}

export function formatCountdown(eventDateIso: string, now = Date.now()) {
  const { days, hours, mins, secs } = splitRemain(remainMs(eventDateIso, now));
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m ${secs}s`;
  }
  return `${hours}h ${mins}m ${secs}s`;
}

export function countdownParts(eventDateIso: string, now: number) {
  const remain = remainMs(eventDateIso, now);
  const { days, hours, mins, secs } = splitRemain(remain);
  const parts = days > 0 ? [{ n: days, u: "d" }] : [];
  parts.push(
    { n: hours, u: "h" },
    { n: mins, u: "m" },
    { n: secs, u: "s" },
  );
  return parts;
}

export function formatWatchClock(now: number, agoSec: number) {
  return new Date(now - agoSec * 1000).toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function getSlotBid(athlete: DemoAthlete, slot: SlotId): DemoBid {
  return athlete.bids[slot] ?? { cents: null, brand: null };
}

export function previewNextBidCents(currentCents: number | null) {
  return nextBidCents(currentCents);
}

export function openSlotCount(
  athlete: DemoAthlete,
  slotIds: SlotId[],
) {
  return slotIds.filter((id) => !athlete.bids[id]?.cents).length;
}

// Sum of demo bids on this body. Shown as "I'm paid $X".
export function paidCents(athlete: DemoAthlete) {
  return Object.values(athlete.bids).reduce(
    (sum, bid) => sum + (bid?.cents ?? 0),
    0,
  );
}
