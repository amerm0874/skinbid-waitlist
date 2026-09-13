"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BRAND_CATEGORIES,
  PAYOUT_ACCOUNT_MAX,
  PAYOUT_RAIL,
  dobInputBounds,
  initialSportDetail,
  isAdultDob,
  isAthleteSport,
  isBrandCategory,
  looksLikeEmail,
  parseAthleteSport,
  parseRole,
  pathAfterProfile,
  INTENDED_ROLE_KEY,
  type Role,
} from "@/lib/config";
import CountrySelect from "@/components/product/CountrySelect";
import SportFields from "@/components/product/SportFields";
import { SocialNetworkIcon } from "@/components/product/SocialNetworkIcon";
import { isCountry } from "@/lib/countries";
import { logoClientError } from "@/lib/logo";
import {
  emptySocialRow,
  filledSocialAccounts,
  parseSocialAccounts,
  SOCIAL_MAX,
  SOCIAL_NETWORKS,
  type SocialAccount,
  type SocialNetwork,
} from "@/lib/socials";
import { dbErrorMessage } from "@/lib/db-error";
import { uploadBrandLogo } from "@/lib/uploads";
import type { Profile } from "@/lib/types";

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

export default function OnboardingForm({
  userId,
  email,
  profile,
  intendedRole,
}: {
  userId: string;
  email: string;
  profile: Profile | null;
  intendedRole?: Role | null;
}) {
  const router = useRouter();
  const roleLocked = Boolean(profile?.role);
  const [role, setRole] = useState<Role>(() => {
    if (profile?.role) {
      return profile.role;
    }
    if (intendedRole) {
      return intendedRole;
    }
    if (typeof window !== "undefined") {
      const stored = parseRole(window.localStorage.getItem(INTENDED_ROLE_KEY));
      if (stored) {
        return stored;
      }
    }
    return "athlete";
  });
  const [name, setName] = useState(profile?.name ?? "");
  const [country, setCountry] = useState(() => profile?.country?.trim() ?? "");
  const [dob, setDob] = useState(() => {
    const saved = profile?.dob?.slice(0, 10) ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : "";
  });
  const [sport, setSport] = useState(
    isAthleteSport(profile?.sport) ? profile.sport : "",
  );
  const [sportDetail, setSportDetail] = useState(() =>
    initialSportDetail(profile?.sport, profile?.sport_detail),
  );
  const [socialRows, setSocialRows] = useState<SocialAccount[]>(() =>
    parseSocialAccounts(profile?.socials, profile?.social),
  );
  const [website, setWebsite] = useState(profile?.website ?? "");
  const [brandCategory, setBrandCategory] = useState(
    profile?.brand_category && isBrandCategory(profile.brand_category)
      ? profile.brand_category
      : "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [paypalEmail, setPaypalEmail] = useState(
    looksLikeEmail(profile?.payout_account ?? "")
      ? (profile?.payout_account ?? "")
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function setSocialRow(index: number, patch: Partial<SocialAccount>) {
    setSocialRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addSocialRow() {
    if (socialRows.length >= SOCIAL_MAX) {
      return;
    }
    setSocialRows((rows) => [...rows, emptySocialRow()]);
  }

  function athleteError() {
    if (!name.trim()) {
      return "Enter a display name.";
    }
    if (!country.trim() || (!isCountry(country) && country !== profile?.country)) {
      return "Pick your country.";
    }
    if (!isAdultDob(dob)) {
      return "Athletes must be 18 or older.";
    }
    const parsedSport = parseAthleteSport(sport, sportDetail);
    if (!parsedSport.ok) {
      return parsedSport.error;
    }
    if (filledSocialAccounts(socialRows).length === 0) {
      return "Enter one social, like Instagram or X.";
    }
    if (paypalEmail.trim() && !looksLikeEmail(paypalEmail)) {
      return "Enter a PayPal email.";
    }
    return "";
  }

  function brandError() {
    if (!name.trim()) {
      return "Enter the brand name.";
    }
    const site = normalizeWebsite(website);
    if (!looksLikeWebsite(site)) {
      return "Enter a website, like brand.com.";
    }
    if (!isBrandCategory(brandCategory)) {
      return "Pick a category.";
    }
    if (logoFile) {
      return logoClientError(logoFile);
    }
    return "";
  }

  async function saveProfile() {
    const nextError = role === "athlete" ? athleteError() : brandError();
    if (nextError) {
      setErrorMessage(nextError);
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      let logoUrl = role === "brand" ? (profile?.logo_url ?? null) : null;
      if (role === "brand" && logoFile) {
        logoUrl = await uploadBrandLogo(userId, logoFile);
      }

      const accounts = filledSocialAccounts(socialRows);
      const paypal = paypalEmail.trim();
      const method = profile ? "PATCH" : "POST";
      const response = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          name: name.trim(),
          country: role === "athlete" ? country.trim() : "",
          dob: role === "athlete" ? dob : "",
          sport: role === "athlete" ? sport : "",
          sport_detail: role === "athlete" ? sportDetail : null,
          socials: role === "athlete" ? accounts : [],
          website: role === "brand" ? normalizeWebsite(website) : "",
          brand_category: role === "brand" ? brandCategory : "",
          logo_url: logoUrl,
          paypal_email: role === "athlete" ? paypal : "",
        }),
      });
      let payload: { error?: string; next?: string } = {};
      try {
        payload = (await response.json()) as {
          error?: string;
          next?: string;
        };
      } catch {
        throw new Error(`Save failed (${response.status})`);
      }
      if (!response.ok) {
        throw payload;
      }

      console.log("Profile saved", role, email);
      window.localStorage.removeItem(INTENDED_ROLE_KEY);
      const next =
        payload.next ||
        pathAfterProfile({
          role,
          name: name.trim(),
          dob: role === "athlete" ? dob : null,
          sport: role === "athlete" ? sport : null,
          sport_detail: role === "athlete" ? sportDetail : null,
          website: role === "brand" ? normalizeWebsite(website) : null,
          brand_category: role === "brand" ? brandCategory : null,
          payout_rail:
            role === "athlete" && looksLikeEmail(paypal) ? PAYOUT_RAIL : null,
          payout_account:
            role === "athlete" && looksLikeEmail(paypal) ? paypal : null,
        });
      router.push(next);
      router.refresh();
    } catch (error) {
      console.log("Onboarding failed", error);
      setErrorMessage(dbErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveProfile();
  }

  return (
    <form onSubmit={handleSubmit} className="form-shell max-w-lg">
      {roleLocked ? (
        <p className="field-label">
          {role === "brand" ? "Brand" : "Athlete"}. This cannot change.
        </p>
      ) : (
        <fieldset>
          <legend className="field-label">Role</legend>
          <div className="seg w-full">
            <button
              type="button"
              className={`flex-1 ${role === "athlete" ? "is-on" : ""}`}
              onClick={() => {
                setRole("athlete");
                setErrorMessage("");
              }}
            >
              Athlete
            </button>
            <button
              type="button"
              className={`flex-1 ${role === "brand" ? "is-on" : ""}`}
              onClick={() => {
                setRole("brand");
                setErrorMessage("");
              }}
            >
              Brand
            </button>
          </div>
        </fieldset>
      )}

      <label className="mt-5 block">
        <span className="field-label">
          {role === "brand" ? "Brand name" : "Display name"}
        </span>
        <input
          className="field"
          name="name"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {role === "athlete" ? (
        <>
          <label className="mt-4 block">
            <span className="field-label">Country</span>
            <CountrySelect
              required
              value={country}
              onChange={setCountry}
            />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Date of birth</span>
            <input
              className="field"
              type="date"
              name="dob"
              autoComplete="off"
              required
              min={dobInputBounds().min}
              max={dobInputBounds().max}
              value={dob}
              onChange={(event) => setDob(event.target.value)}
            />
            <span className="mt-2 block text-[12px] text-muted">
              18 or older.
            </span>
          </label>
          <SportFields
            sport={sport}
            sportDetail={sportDetail}
            onSportChange={setSport}
            onSportDetailChange={setSportDetail}
          />
          <div className="mt-4">
            <span className="field-label">Social</span>
            {socialRows.map((row, index) => (
              <div key={index} className="social-row mt-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
                  <SocialNetworkIcon network={row.network} />
                </span>
                <select
                  className="field"
                  name={`social_network_${index + 1}`}
                  autoComplete="off"
                  value={row.network}
                  onChange={(event) =>
                    setSocialRow(index, {
                      network: event.target.value as SocialNetwork,
                    })
                  }
                >
                  {SOCIAL_NETWORKS.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  name={`social_handle_${index + 1}`}
                  autoComplete="off"
                  value={row.handle}
                  onChange={(event) =>
                    setSocialRow(index, { handle: event.target.value })
                  }
                />
              </div>
            ))}
            {socialRows.length < SOCIAL_MAX ? (
              <button
                type="button"
                className="btn btn-ghost mt-2"
                onClick={addSocialRow}
              >
                +
              </button>
            ) : null}
            <span className="mt-2 block text-[12px] text-muted">
              Instagram, X, or a URL.
            </span>
          </div>

          {/* Destination only. We do not call Polar, Dodo, or Stripe. */}
          <label className="mt-4 block">
            <span className="field-label">PayPal email</span>
            <input
              className="field"
              type="email"
              name="paypal_email"
              autoComplete="off"
              inputMode="email"
              maxLength={PAYOUT_ACCOUNT_MAX}
              value={paypalEmail}
              onChange={(event) => setPaypalEmail(event.target.value)}
            />
            <span className="mt-2 block text-[12px] text-muted">
              Optional. We send your 80% here after proof.
            </span>
          </label>
        </>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="field-label">Website</span>
            <input
              className="field"
              name="website"
              inputMode="url"
              autoComplete="off"
              required
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Category</span>
            <select
              className="field"
              name="brand_category"
              autoComplete="off"
              required
              value={brandCategory}
              onChange={(event) => setBrandCategory(event.target.value)}
            >
              <option value="" disabled>
                Select category
              </option>
              {BRAND_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="mt-2 block text-[12px] text-muted">
              One category. Later, two brands in the same category cannot share
              an event.
            </span>
          </label>
          <label className="mt-4 block">
            <span className="field-label">Logo (optional PNG)</span>
            <input
              className="field"
              type="file"
              name="logo"
              accept="image/png"
              onChange={(event) =>
                setLogoFile(event.target.files?.[0] ?? null)
              }
            />
            {profile?.logo_url ? (
              <span className="mt-2 block text-[12px] text-muted">
                A logo is already saved. Upload a new PNG to replace it.
              </span>
            ) : null}
          </label>
        </>
      )}

      {errorMessage ? (
        <p className="mt-4 text-[13px] text-danger">{errorMessage}</p>
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-solid mt-6">
        {busy ? "Saving…" : role === "brand" ? "Save brand" : "Save profile"}
      </button>
    </form>
  );
}
