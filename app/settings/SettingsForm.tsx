"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BRAND_CATEGORIES,
  PAYOUT_ACCOUNT_MAX,
  initialSportDetail,
  isAthleteSport,
  isBrandCategory,
  looksLikeEmail,
  parseAthleteSport,
} from "@/lib/config";
import CountrySelect from "@/components/product/CountrySelect";
import SportFields from "@/components/product/SportFields";
import { SocialNetworkIcon } from "@/components/product/SocialNetworkIcon";
import { isCountry } from "@/lib/countries";
import { logoClientError } from "@/lib/logo";
import { photoClientError, uploadProfilePhoto } from "@/lib/photo";
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

export default function SettingsForm({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const router = useRouter();
  const isBrand = profile.role === "brand";
  const [name, setName] = useState(profile.name ?? "");
  const [country, setCountry] = useState(() => profile.country?.trim() ?? "");
  const [sport, setSport] = useState(
    isAthleteSport(profile.sport) ? profile.sport : "",
  );
  const [sportDetail, setSportDetail] = useState(() =>
    initialSportDetail(profile.sport, profile.sport_detail),
  );
  const [socialRows, setSocialRows] = useState<SocialAccount[]>(() =>
    parseSocialAccounts(profile.socials, profile.social),
  );
  const [website, setWebsite] = useState(profile.website ?? "");
  const [brandCategory, setBrandCategory] = useState(
    profile.brand_category && isBrandCategory(profile.brand_category)
      ? profile.brand_category
      : "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(profile.photo_url ?? "");
  const [savedPhotoUrl, setSavedPhotoUrl] = useState(profile.photo_url ?? null);
  const [paypalEmail, setPaypalEmail] = useState(
    looksLikeEmail(profile.payout_account ?? "")
      ? (profile.payout_account ?? "")
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
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
    if (!country.trim() || (!isCountry(country) && country !== profile.country)) {
      return "Pick your country.";
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
    if (photoFile) {
      return photoClientError(photoFile);
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
    const nextError = isBrand ? brandError() : athleteError();
    if (nextError) {
      setErrorMessage(nextError);
      setSaved(false);
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setSaved(false);
    try {
      let logoUrl = isBrand ? (profile.logo_url ?? null) : null;
      if (isBrand && logoFile) {
        logoUrl = await uploadBrandLogo(userId, logoFile);
      }
      let photoUrl = isBrand ? null : savedPhotoUrl;
      if (!isBrand && photoFile) {
        photoUrl = await uploadProfilePhoto(userId, photoFile);
      }

      const accounts = filledSocialAccounts(socialRows);
      const paypal = paypalEmail.trim();
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: profile.role,
          name: name.trim(),
          country: isBrand ? "" : country.trim(),
          sport: isBrand ? "" : sport,
          sport_detail: isBrand ? null : sportDetail,
          socials: isBrand ? [] : accounts,
          website: isBrand ? normalizeWebsite(website) : "",
          brand_category: isBrand ? brandCategory : "",
          logo_url: logoUrl,
          photo_url: photoUrl,
          paypal_email: isBrand ? "" : paypal,
          stay: true,
        }),
      });
      let payload: { error?: string } = {};
      try {
        payload = (await response.json()) as { error?: string };
      } catch {
        throw new Error(`Save failed (${response.status})`);
      }
      if (!response.ok) {
        throw payload;
      }

      console.log("Settings saved", profile.role);
      if (!isBrand) {
        setSavedPhotoUrl(photoUrl);
        setPhotoPreview(photoUrl ?? "");
      }
      setPhotoFile(null);
      setLogoFile(null);
      setSaved(true);
      router.refresh();
    } catch (error) {
      console.log("Settings save failed", error);
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
      {isBrand ? (
        <>
          <label className="block">
            <span className="field-label">Brand name</span>
            <input
              className="field"
              name="name"
              autoComplete="organization"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
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
            {profile.logo_url ? (
              <span className="mt-2 block text-[12px] text-muted">
                A logo is already saved. Upload a new PNG to replace it.
              </span>
            ) : null}
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className="field-label">Photo</span>
            {photoPreview ? (
              <img
                key={photoPreview}
                src={photoPreview}
                alt=""
                className="settings-photo"
              />
            ) : (
              <span className="settings-photo settings-photo-empty">
                {name.trim().slice(0, 1).toUpperCase() || "A"}
              </span>
            )}
            <input
              className="field mt-2"
              type="file"
              name="photo"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setPhotoFile(file);
                if (file) {
                  setPhotoPreview(URL.createObjectURL(file));
                }
              }}
            />
            <span className="mt-2 block text-[12px] text-muted">
              {photoPreview
                ? "Replace with a square JPG or PNG."
                : "Square JPG or PNG."}
            </span>
          </label>
          <label className="mt-4 block">
            <span className="field-label">Display name</span>
            <input
              className="field"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="mt-4 block">
            <span className="field-label">Country</span>
            <CountrySelect required value={country} onChange={setCountry} />
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
          </div>
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
      )}

      {errorMessage ? (
        <p className="mt-4 text-[13px] text-danger">{errorMessage}</p>
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-solid mt-6">
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
