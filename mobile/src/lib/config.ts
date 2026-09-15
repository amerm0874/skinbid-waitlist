// Ported from the web app's lib/config.ts. Pure business rules only — the
// path-string helpers there (loginPath, onboardingPath, ...) are Next.js
// route strings and are replaced on mobile by the navigation logic in
// lib/session.tsx, which maps the same profile-completeness checks to
// Expo Router routes instead.

export type Role = "athlete" | "brand";

export function parseRole(value: string | null | undefined): Role | null {
  return value === "athlete" || value === "brand" ? value : null;
}

export const SITE = {
  name: "SkinBid",
  title: "SkinBid — Your next race already has ad space",
  description:
    "List logo slots on your body. Brands pay SkinBid. You wear a temp tattoo for one day.",
  url: "https://www.skinbid.me",
  email: "skinbidme@gmail.com",
};

export const FLOOR_CENTS = 10_000;
export const BID_STEP_CENTS = 10_000;
export const ATHLETE_SHARE = 0.8;
export const PLATFORM_SHARE = 0.2;
export const AUCTION_CLOSE_HOURS = 48;
export const EVENT_MIN_DAYS = 4;
export const EVENT_MAX_MONTHS = 12;

export const BRAND_CATEGORIES = [
  "Drink",
  "Apparel",
  "Finance",
  "Tech",
  "Food",
  "Other",
] as const;
export type BrandCategory = (typeof BRAND_CATEGORIES)[number];

export function isBrandCategory(
  value: string | null | undefined,
): value is BrandCategory {
  return (BRAND_CATEGORIES as readonly string[]).includes(value ?? "");
}

// Name + website + one category. Logo is optional. Used later for competitor lock.
export function brandOnboardingComplete(
  profile:
    | { role?: string | null; name?: string | null; website?: string | null; brand_category?: string | null }
    | null
    | undefined,
) {
  if (!profile || profile.role !== "brand") {
    return false;
  }
  return (
    Boolean(profile.name?.trim()) &&
    Boolean(profile.website?.trim()) &&
    isBrandCategory(profile.brand_category)
  );
}

export const PAYOUT_RAIL = "PayPal" as const;
export const PAYOUT_ACCOUNT_MAX = 254;

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const ATHLETE_AGE_MIN = 18;
export const ATHLETE_AGE_MAX = 99;

export const ATHLETE_GENDERS = ["Male", "Female"] as const;
export type AthleteGender = (typeof ATHLETE_GENDERS)[number];

export function isAthleteGender(value: string | null | undefined): value is AthleteGender {
  return (ATHLETE_GENDERS as readonly string[]).includes(value ?? "");
}

export const ATHLETE_SPORTS = [
  "HYROX",
  "Running",
  "CrossFit",
  "Combat",
  "Athletics",
  "Other",
] as const;
export type AthleteSport = (typeof ATHLETE_SPORTS)[number];

export const COMBAT_SPORTS = ["Boxing", "MMA", "Kickboxing", "Wrestling", "BJJ"] as const;
export type CombatSport = (typeof COMBAT_SPORTS)[number];

export const SPORT_DETAIL_MAX = 40;

export function isAthleteSport(value: string | null | undefined): value is AthleteSport {
  return (ATHLETE_SPORTS as readonly string[]).includes(value ?? "");
}

export function isCombatSport(value: string | null | undefined): value is CombatSport {
  return (COMBAT_SPORTS as readonly string[]).includes(value ?? "");
}

export type ParsedAthleteSport = { sport: AthleteSport; sport_detail: string | null };

export function parseAthleteSport(
  sportRaw: string | null | undefined,
  detailRaw: string | null | undefined,
): ({ ok: true } & ParsedAthleteSport) | { ok: false; error: string } {
  const sport = (sportRaw ?? "").trim();
  const detail = (detailRaw ?? "").trim();
  if (!isAthleteSport(sport)) {
    return { ok: false, error: "Pick a sport." };
  }
  if (sport === "Combat") {
    if (!isCombatSport(detail)) {
      return { ok: false, error: "Pick a combat sport." };
    }
    return { ok: true, sport, sport_detail: detail };
  }
  if (sport === "Other") {
    if (!detail) {
      return { ok: false, error: "Enter your sport." };
    }
    if (detail.length > SPORT_DETAIL_MAX) {
      return { ok: false, error: "Keep the sport short." };
    }
    return { ok: true, sport, sport_detail: detail };
  }
  return { ok: true, sport, sport_detail: null };
}

export function athleteSportLabel(sport: string | null | undefined, detail?: string | null) {
  const parsed = parseAthleteSport(sport, detail);
  if (!parsed.ok) {
    return (sport ?? "").trim() || null;
  }
  if (parsed.sport === "Combat" && parsed.sport_detail) {
    return `${parsed.sport} · ${parsed.sport_detail}`;
  }
  if (parsed.sport === "Other" && parsed.sport_detail) {
    return parsed.sport_detail;
  }
  return parsed.sport;
}

export function athleteSportComplete(
  profile: { sport?: string | null; sport_detail?: string | null } | null | undefined,
) {
  return parseAthleteSport(profile?.sport, profile?.sport_detail).ok;
}

export function isAdultAge(age: unknown): age is number {
  return typeof age === "number" && Number.isInteger(age) && age >= ATHLETE_AGE_MIN && age <= ATHLETE_AGE_MAX;
}

export function ageFromDob(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) age -= 1;
  return age;
}

export function isAdultDob(value: string | null | undefined) {
  return isAdultAge(ageFromDob(value));
}

export function athleteIsAdult(profile: { dob?: string | null; age?: number | null } | null | undefined) {
  if (isAdultDob(profile?.dob ?? null)) return true;
  return isAdultAge(profile?.age);
}

export function dobInputBounds() {
  const max = new Date();
  max.setFullYear(max.getFullYear() - ATHLETE_AGE_MIN);
  const min = new Date();
  min.setFullYear(min.getFullYear() - ATHLETE_AGE_MAX);
  return { min, max };
}

export function athleteHasPayout(
  profile: { role?: string | null; payout_rail?: string | null; payout_account?: string | null } | null | undefined,
) {
  if (!profile || profile.role !== "athlete") return false;
  return profile.payout_rail === PAYOUT_RAIL && looksLikeEmail(profile.payout_account ?? "");
}

export type AuthProfile = {
  role?: string | null;
  name?: string | null;
  dob?: string | null;
  age?: number | null;
  sport?: string | null;
  sport_detail?: string | null;
  website?: string | null;
  brand_category?: string | null;
  payout_rail?: string | null;
  payout_account?: string | null;
};

export function athleteOnboardingComplete(profile: AuthProfile | null | undefined) {
  return athleteIsAdult(profile) && athleteSportComplete(profile);
}

/** "onboarding" | "me" (athlete home) | "events" (brand home) — mobile router maps these to actual routes. */
export function destinationForProfile(profile: AuthProfile | null | undefined): "onboarding" | "me" | "events" {
  if (!profile?.role) return "onboarding";
  if (profile.role === "athlete" && !athleteOnboardingComplete(profile)) return "onboarding";
  if (profile.role === "brand" && !brandOnboardingComplete(profile)) return "onboarding";
  return profile.role === "athlete" ? "me" : "events";
}
