import { safeReturnPath } from "@/lib/launch";

export type Role = "athlete" | "brand";

export function parseRole(
  value: string | string[] | null | undefined,
): Role | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "athlete" || raw === "brand") {
    return raw;
  }
  return null;
}

export const SIGNIN_AGAIN_HREF = "/login?error=signin";

const AUTH_GATE_SEGMENTS = new Set([
  "onboarding",
  "new",
  "me",
  "settings",
  "proof",
  "admin",
  "outreach",
]);

export function isAuthGatePath(pathname: string) {
  const pathOnly = pathname.split("?")[0] ?? "";
  const segment = pathOnly.split("/").filter(Boolean)[0] ?? "";
  return AUTH_GATE_SEGMENTS.has(segment);
}

export function loginPath(role?: Role | null, next?: string | null) {
  const params = new URLSearchParams();
  if (role) {
    params.set("role", role);
  }
  const returnTo = safeReturnPath(next ?? null);
  if (returnTo) {
    params.set("next", returnTo);
  }
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function signupPath(role?: Role | null) {
  return role ? `/signup?role=${role}` : "/signup";
}

export function onboardingPath(role?: Role | null) {
  return role ? `/onboarding?role=${role}` : "/onboarding";
}

export const INTENDED_ROLE_KEY = "skinbid_intended_role";

// After a profile exists, athletes land on /me. Listing an event is optional.
export function pathForRole(role: string | null | undefined) {
  if (role === "athlete") {
    return "/me";
  }
  if (role === "brand") {
    return "/events";
  }
  return "/onboarding";
}

export const SITE = {
  name: "SkinBid",
  title: "SkinBid — Event-day body slots",
  description:
    "List logo slots on your body for any event. Brands pay SkinBid. You wear a temp tattoo for one day. You get paid after we check the photos.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://www.skinbid.me",
  email: "skinbidme@gmail.com",
  ogHeadline: "Sell the skin. Keep the medal.",
};

// How many waitlist posts one IP can send in the window.
export const WAITLIST_RATE_LIMIT = 8;
export const WAITLIST_RATE_WINDOW_MS = 10 * 60 * 1000;

export const FLOOR_CENTS = 10_000;
export const BID_STEP_CENTS = 10_000;
export const ATHLETE_SHARE = 0.8;
export const PLATFORM_SHARE = 0.2;
export const AUCTION_CLOSE_HOURS = 48;
export const EVENT_MIN_DAYS = 4;
export const EVENT_MAX_MONTHS = 12;

export const BRAND_BUDGETS = ["<$500", "$500–2k", "$2k+"] as const;
export type BrandBudget = (typeof BRAND_BUDGETS)[number];

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
export function brandOnboardingComplete(profile: {
  role?: string | null;
  name?: string | null;
  website?: string | null;
  brand_category?: string | null;
} | null | undefined) {
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
export type PayoutRail = typeof PAYOUT_RAIL;
export const PAYOUT_ACCOUNT_MAX = 254;

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const ATHLETE_AGE_MIN = 18;
export const ATHLETE_AGE_MAX = 99;

export const ATHLETE_SPORTS = [
  "HYROX",
  "Running",
  "CrossFit",
  "Combat",
  "Athletics",
  "Other",
] as const;
export type AthleteSport = (typeof ATHLETE_SPORTS)[number];

export const COMBAT_SPORTS = [
  "Boxing",
  "MMA",
  "Kickboxing",
  "Wrestling",
  "BJJ",
] as const;
export type CombatSport = (typeof COMBAT_SPORTS)[number];

export const SPORT_DETAIL_MAX = 40;

export function isAthleteSport(
  value: string | null | undefined,
): value is AthleteSport {
  return (ATHLETE_SPORTS as readonly string[]).includes(value ?? "");
}

export function isCombatSport(
  value: string | null | undefined,
): value is CombatSport {
  return (COMBAT_SPORTS as readonly string[]).includes(value ?? "");
}

export type ParsedAthleteSport = {
  sport: AthleteSport;
  sport_detail: string | null;
};

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

export function athleteSportLabel(
  sport: string | null | undefined,
  detail?: string | null,
) {
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

export function athleteSportComplete(profile: {
  sport?: string | null;
  sport_detail?: string | null;
} | null | undefined) {
  return parseAthleteSport(profile?.sport, profile?.sport_detail).ok;
}

export function initialSportDetail(
  sport: string | null | undefined,
  detail: string | null | undefined,
) {
  if (sport === "Combat" && isCombatSport(detail)) {
    return detail;
  }
  if (sport === "Other") {
    return (detail ?? "").trim().slice(0, SPORT_DETAIL_MAX);
  }
  return "";
}

export function isAdultAge(age: unknown): age is number {
  return (
    typeof age === "number" &&
    Number.isInteger(age) &&
    age >= ATHLETE_AGE_MIN &&
    age <= ATHLETE_AGE_MAX
  );
}

export function ageFromDob(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? "");
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < day)) {
    age -= 1;
  }
  return age;
}

export function isAdultDob(value: string | null | undefined) {
  return isAdultAge(ageFromDob(value));
}

export function athleteIsAdult(profile: {
  dob?: string | null;
  age?: number | null;
} | null | undefined) {
  if (isAdultDob(profile?.dob ?? null)) {
    return true;
  }
  return isAdultAge(profile?.age);
}

export function dobInputBounds() {
  const max = new Date();
  max.setFullYear(max.getFullYear() - ATHLETE_AGE_MIN);
  const min = new Date();
  min.setFullYear(min.getFullYear() - ATHLETE_AGE_MAX);
  const iso = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { min: iso(min), max: iso(max) };
}

export function athleteHasPayout(profile: {
  role?: string | null;
  payout_rail?: string | null;
  payout_account?: string | null;
} | null | undefined) {
  if (!profile || profile.role !== "athlete") {
    return false;
  }
  return (
    profile.payout_rail === PAYOUT_RAIL &&
    looksLikeEmail(profile.payout_account ?? "")
  );
}

export function athleteOnboardingComplete(profile: {
  role?: string | null;
  dob?: string | null;
  age?: number | null;
  payout_rail?: string | null;
  payout_account?: string | null;
} | null | undefined) {
  return athleteHasPayout(profile) && athleteIsAdult(profile);
}

export function pathAfterProfile(profile: {
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
} | null | undefined) {
  if (!profile?.role) {
    return "/onboarding";
  }
  // PayPal is optional on athlete onboarding. Auction create still checks payout.
  if (
    profile.role === "athlete" &&
    (!athleteIsAdult(profile) || !athleteSportComplete(profile))
  ) {
    return "/onboarding";
  }
  if (profile.role === "brand" && !brandOnboardingComplete(profile)) {
    return "/onboarding";
  }
  return pathForRole(profile.role);
}

type AuthProfile = {
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

export function homeForCompleteProfile(profile: AuthProfile | null | undefined) {
  if (profile?.role === "brand") {
    return "/events";
  }
  if (profile?.role === "athlete") {
    return "/me";
  }
  return onboardingPath();
}

// Incomplete → /onboarding?role=. Complete athlete → /me (or ?next=/new). Complete brand → /events.
export function destinationAfterAuth(
  profile: AuthProfile | null | undefined,
  role?: Role | null,
  next?: string | null,
) {
  const mapped = pathAfterProfile(profile);
  if (mapped === "/onboarding") {
    return onboardingPath(parseRole(profile?.role) ?? role);
  }
  const returnTo = safeReturnPath(next ?? null);
  if (returnTo) {
    const returnPath = returnTo.split("?")[0] ?? "";
    if (returnPath !== "/onboarding") {
      return returnTo;
    }
  }
  return homeForCompleteProfile(profile);
}

export function sessionGateRedirect(
  user: { id: string } | null | undefined,
  profile: AuthProfile | null | undefined,
  pathname: string,
  role?: Role | null,
) {
  if (!user) {
    return isAuthGatePath(pathname) ? loginPath(role, pathname) : null;
  }
  if (pathAfterProfile(profile) === "/onboarding") {
    if (pathname === "/onboarding") {
      return null;
    }
    return onboardingPath(parseRole(profile?.role) ?? role);
  }
  return null;
}
