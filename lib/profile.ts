import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageFromDob,
  isAdultDob,
  isBrandCategory,
  looksLikeEmail,
  parseAthleteSport,
  parseRole,
  pathAfterProfile,
  PAYOUT_RAIL,
  type BrandCategory,
} from "@/lib/config";
import { isCountry } from "@/lib/countries";
import { dbErrorMessage, isMissingColumn } from "@/lib/db-error";
import { clearAthletePayout, saveAthletePayout } from "@/lib/payout";
import {
  filledSocialAccounts,
  isSocialNetwork,
  socialUrl,
  type SocialAccount,
} from "@/lib/socials";
import type { Profile } from "@/lib/types";

export const PROFILE_PUBLIC_SELECT =
  "id, role, name, country, dob, age, sport, sport_detail, social, socials, brand_category, website, logo_url, photo_url";

const PROFILE_PUBLIC_SELECT_NO_PHOTO =
  "id, role, name, country, dob, age, sport, sport_detail, social, socials, brand_category, website, logo_url";

const PROFILE_PUBLIC_SELECT_NO_DETAIL =
  "id, role, name, country, dob, age, sport, social, socials, brand_category, website, logo_url, photo_url";

const PROFILE_BASIC_SELECT =
  "id, role, name, country, social, brand_category, website, logo_url";

export type ProfileBody = {
  role?: string;
  name?: string;
  country?: string;
  dob?: string;
  sport?: string;
  sport_detail?: string | null;
  socials?: unknown;
  website?: string;
  brand_category?: string;
  logo_url?: string | null;
  photo_url?: string | null;
  paypal_email?: string;
  stay?: boolean;
};

type ProfileFields = Omit<Profile, "payout_rail" | "payout_account">;

export async function loadProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileFields | null> {
  const full = await supabase
    .from("profiles")
    .select(PROFILE_PUBLIC_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (!full.error) {
    return (full.data as ProfileFields | null) ?? null;
  }
  if (isMissingColumn(full.error, "photo_url")) {
    const withoutPhoto = await supabase
      .from("profiles")
      .select(PROFILE_PUBLIC_SELECT_NO_PHOTO)
      .eq("id", userId)
      .maybeSingle();
    if (!withoutPhoto.error) {
      return (withoutPhoto.data as ProfileFields | null) ?? null;
    }
  }
  if (isMissingColumn(full.error, "sport_detail")) {
    const withoutDetail = await supabase
      .from("profiles")
      .select(PROFILE_PUBLIC_SELECT_NO_DETAIL)
      .eq("id", userId)
      .maybeSingle();
    if (!withoutDetail.error) {
      return (withoutDetail.data as ProfileFields | null) ?? null;
    }
  }
  const basic = await supabase
    .from("profiles")
    .select(PROFILE_BASIC_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (basic.error) {
    console.log("Profile select failed", full.error.message);
    console.log("Profile basic select failed", basic.error.message);
    return null;
  }
  return (basic.data as ProfileFields | null) ?? null;
}

function parseBodySocials(raw: unknown): SocialAccount[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return filledSocialAccounts(
    raw.flatMap((row) => {
      if (!row || typeof row !== "object") {
        return [];
      }
      const record = row as { network?: unknown; handle?: unknown };
      const network = String(record.network ?? "");
      if (!isSocialNetwork(network)) {
        return [];
      }
      return [{ network, handle: String(record.handle ?? "") }];
    }),
  );
}

function normalizeWebsite(raw: string) {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function looksLikeWebsite(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export type ProfileSaveResult =
  | { ok: true; next: string }
  | {
      ok: false;
      status: number;
      error: unknown;
    };

export async function saveSessionProfile(
  supabase: SupabaseClient,
  userId: string,
  existing: {
    role?: string | null;
    country?: string | null;
    dob?: string | null;
    photo_url?: string | null;
    logo_url?: string | null;
  } | null,
  body: ProfileBody,
): Promise<ProfileSaveResult> {
  const lockedRole = parseRole(existing?.role);
  const role = lockedRole ?? parseRole(body.role);
  if (!role) {
    return { ok: false, status: 400, error: "Pick athlete or brand." };
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return {
      ok: false,
      status: 400,
      error: role === "brand" ? "Enter the brand name." : "Enter a display name.",
    };
  }

  let row: Record<string, unknown>;
  let paypal = "";

  if (role === "athlete") {
    const country = (body.country ?? "").trim();
    if (!country || (!isCountry(country) && country !== existing?.country)) {
      return { ok: false, status: 400, error: "Pick your country." };
    }
    const dob = (body.dob ?? existing?.dob ?? "").trim().slice(0, 10);
    if (!isAdultDob(dob)) {
      return { ok: false, status: 400, error: "Athletes must be 18 or older." };
    }
    const parsedSport = parseAthleteSport(body.sport, body.sport_detail);
    if (!parsedSport.ok) {
      return { ok: false, status: 400, error: parsedSport.error };
    }
    const accounts = parseBodySocials(body.socials);
    if (accounts.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Enter one social, like Instagram or X.",
      };
    }
    paypal = (body.paypal_email ?? "").trim();
    if (paypal && !looksLikeEmail(paypal)) {
      return { ok: false, status: 400, error: "Enter a PayPal email." };
    }
    const firstSocial = accounts[0];
    const computedAge = ageFromDob(dob);
    const photoUrl =
      typeof body.photo_url === "string" && body.photo_url.trim()
        ? body.photo_url.trim()
        : body.photo_url === null
          ? null
          : existing?.photo_url ?? null;
    row = {
      role,
      name,
      country,
      dob,
      sport: parsedSport.sport,
      sport_detail: parsedSport.sport_detail,
      social: firstSocial
        ? socialUrl(firstSocial.network, firstSocial.handle)
        : null,
      socials: accounts,
      photo_url: photoUrl,
    };
    if (computedAge != null) {
      row.age = computedAge;
    }
  } else {
    const website = normalizeWebsite(body.website ?? "");
    if (!looksLikeWebsite(website)) {
      return { ok: false, status: 400, error: "Enter a website, like brand.com." };
    }
    const brandCategory = (body.brand_category ?? "").trim();
    if (!isBrandCategory(brandCategory)) {
      return { ok: false, status: 400, error: "Pick a category." };
    }
    const logoUrl =
      typeof body.logo_url === "string" && body.logo_url.trim()
        ? body.logo_url.trim()
        : body.logo_url === null
          ? null
          : existing?.logo_url ?? null;
    row = {
      role,
      name,
      website,
      brand_category: brandCategory as BrandCategory,
      logo_url: logoUrl,
    };
  }

  const written = await writeProfileRow(supabase, userId, Boolean(existing), row);
  if (written.error) {
    return { ok: false, status: 500, error: written.error };
  }

  if (role === "athlete") {
    try {
      if (looksLikeEmail(paypal)) {
        await saveAthletePayout(supabase, userId, paypal);
      } else {
        await clearAthletePayout(supabase, userId);
      }
    } catch (error) {
      return { ok: false, status: 500, error };
    }
  }

  const payout =
    role === "athlete" && looksLikeEmail(paypal)
      ? { payout_rail: PAYOUT_RAIL, payout_account: paypal }
      : { payout_rail: null, payout_account: null };
  const next = body.stay
    ? "/settings"
    : pathAfterProfile({
        role,
        name,
        dob: typeof row.dob === "string" ? row.dob : null,
        age: typeof row.age === "number" ? row.age : null,
        sport: typeof row.sport === "string" ? row.sport : null,
        sport_detail:
          typeof row.sport_detail === "string" ? row.sport_detail : null,
        website: typeof row.website === "string" ? row.website : null,
        brand_category:
          typeof row.brand_category === "string" ? row.brand_category : null,
        ...payout,
      });

  return { ok: true, next };
}

async function writeProfileRow(
  supabase: SupabaseClient,
  userId: string,
  hasRow: boolean,
  row: Record<string, unknown>,
) {
  const insertRow = { ...row, id: userId };

  async function insert() {
    return supabase.from("profiles").insert(insertRow).select("id").maybeSingle();
  }

  async function update(payload: Record<string, unknown>) {
    return supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("id")
      .maybeSingle();
  }

  let result = hasRow ? await update(row) : await insert();
  if (
    result.error &&
    (result.error.code === "23505" ||
      (result.error.message ?? "").toLowerCase().includes("duplicate"))
  ) {
    result = await update(row);
  }

  if (
    result.error &&
    row.age != null &&
    isMissingColumn(result.error, "age")
  ) {
    const { age: _age, ...withoutAge } = row;
    void _age;
    result = hasRow
      ? await update(withoutAge)
      : await supabase
          .from("profiles")
          .insert({ ...withoutAge, id: userId })
          .select("id")
          .maybeSingle();
  }

  if (result.error && isMissingColumn(result.error, "sport_detail")) {
    const { sport_detail: _sportDetail, ...withoutDetail } = row;
    void _sportDetail;
    result = hasRow
      ? await update(withoutDetail)
      : await supabase
          .from("profiles")
          .insert({ ...withoutDetail, id: userId })
          .select("id")
          .maybeSingle();
  }

  if (result.error && isMissingColumn(result.error, "photo_url")) {
    const { photo_url: _photoUrl, ...withoutPhoto } = row;
    void _photoUrl;
    result = hasRow
      ? await update(withoutPhoto)
      : await supabase
          .from("profiles")
          .insert({ ...withoutPhoto, id: userId })
          .select("id")
          .maybeSingle();
  }

  if (result.error) {
    console.log("Profile write failed", dbErrorMessage(result.error));
    return result;
  }
  if (!result.data) {
    return {
      error: {
        message: "new row violates row-level security policy for table \"profiles\"",
        code: "42501",
      },
    };
  }
  return result;
}
