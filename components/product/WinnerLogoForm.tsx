"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { captureEvent, captureException } from "@/lib/analytics";
import {
  logoClientError,
  MARK_KIND_LABEL,
  POST_RULES_MAX,
  postRulesError,
  type MarkKind,
} from "@/lib/logo";
import type { WinnerZone } from "@/lib/event-logo";

type Props = {
  slug: string;
  eventName: string;
  athleteName: string;
  isDemo: boolean;
  kinds: MarkKind[];
  zones: WinnerZone[];
};

export function WinnerLogoForm({
  slug,
  eventName,
  athleteName,
  isDemo,
  kinds,
  zones,
}: Props) {
  const [rows, setRows] = useState(zones);

  if (!rows.length) {
    return (
      <p className="text-[15px] text-muted">
        Pay a zone first.
      </p>
    );
  }

  return (
    <div className="logo-desk">
      <p className="page-lead">
        {athleteName} · {eventName}. Transparent PNG. Outbid refunds it. Winner
        prints.
      </p>
      {isDemo ? (
        <p className="fine">Demo desk. Files land in the logos bucket.</p>
      ) : null}
      <ul className="logo-desk-list">
        {rows.map((zone) => (
          <li key={zone.id}>
            <ZoneLogoCard
              slug={slug}
              kinds={kinds}
              zone={zone}
              onSaved={(next) => {
                setRows((current) =>
                  current.map((row) => (row.id === next.id ? next : row)),
                );
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ZoneLogoCard({
  slug,
  kinds,
  zone,
  onSaved,
}: {
  slug: string;
  kinds: MarkKind[];
  zone: WinnerZone;
  onSaved: (zone: WinnerZone) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [markKind, setMarkKind] = useState<MarkKind>(
    zone.markKind ?? kinds[0] ?? "tattoo",
  );
  const [postRules, setPostRules] = useState(zone.postRules);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    const invalid = logoClientError(file);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    const rulesError = postRulesError(postRules.trim());
    if (rulesError) {
      setMessage(rulesError);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("slug", slug);
      body.set("zone_id", zone.id);
      body.set("zone_name", zone.name);
      body.set("mark_kind", markKind);
      body.set("post_rules", postRules.trim());
      body.set("file", file as File);
      const response = await fetch("/api/bids/logo", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        error?: string;
        logo_url?: string;
        mark_kind?: string;
        post_rules?: string;
      };
      if (!response.ok || !payload.logo_url) {
        setMessage(payload.error || "Logo did not save.");
        return;
      }
      console.log("Logo saved", zone.name);
      captureEvent("logo_uploaded", { slug, zone: zone.name });
      setFile(null);
      onSaved({
        ...zone,
        logoUrl: payload.logo_url,
        markKind: payload.mark_kind === "sticker" ? "sticker" : "tattoo",
        postRules: payload.post_rules ?? "",
      });
      setMessage("Logo saved.");
      router.push(`/e/${slug}`);
    } catch (error) {
      console.log("Logo upload failed", error);
      captureException(error);
      setMessage("Logo did not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="form-shell logo-desk-card"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2 className="logo-desk-zone">{zone.label}</h2>
      {zone.logoUrl ? (
        // User PNG from the logos bucket. next/image needs a fixed host list.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={zone.logoUrl} alt="" className="event-logo-preview" />
      ) : null}

      <label className="mt-4 block">
        <span className="field-label">Transparent PNG</span>
        <input
          className="field"
          type="file"
          name="logo"
          accept="image/png"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
        />
        <span className="fine">Max 2 MB. Lead PNG now. Winner PNG prints.</span>
      </label>

      {kinds.length > 1 ? (
        <fieldset className="mt-4">
          <legend className="field-label">Wear as</legend>
          <div className="seg w-full">
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`flex-1 ${markKind === kind ? "is-on" : ""}`}
                onClick={() => setMarkKind(kind)}
              >
                {MARK_KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="mt-4 fine">
          Athlete offered {MARK_KIND_LABEL[kinds[0] ?? "tattoo"]} only.
        </p>
      )}

      <label className="mt-4 block">
        <span className="field-label">Post rules (optional)</span>
        <textarea
          className="field logo-desk-rules"
          name="post_rules"
          rows={3}
          maxLength={POST_RULES_MAX}
          value={postRules}
          disabled={busy}
          placeholder="Tag, photos, or leave blank."
          onChange={(event) => setPostRules(event.target.value)}
        />
      </label>

      {message ? (
        <p
          className={
            message === "Logo saved."
              ? "mt-3 text-[13px] text-accent"
              : "mt-3 text-[13px] text-danger"
          }
        >
          {message}
        </p>
      ) : null}

      <button type="submit" className="btn btn-solid mt-4" disabled={busy}>
        {busy ? "Saving…" : zone.logoUrl ? "Replace PNG" : "Save PNG"}
      </button>
    </form>
  );
}
