"use client";

import { FormEvent, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Phone photos can be large. 12 MB keeps uploads from hanging.
const MAX_BYTES = 12 * 1024 * 1024;

type ProofStatus = "pending" | "approved" | "rejected";

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function fileExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }
  if (file.type === "image/png") {
    return "png";
  }
  if (file.type === "image/webp") {
    return "webp";
  }
  return "jpg";
}

function photoError(file: File | null, label: string) {
  if (!file) {
    return `Add ${label}.`;
  }
  if (!isImage(file)) {
    return `${label} must be a photo.`;
  }
  if (file.size > MAX_BYTES) {
    return `${label} must be under 12 MB.`;
  }
  return "";
}

function normalizePostUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function looksLikeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export default function ProofForm({
  eventId,
  eventName,
  userId,
  existing,
}: {
  eventId: string;
  eventName: string;
  userId: string;
  existing: { status: ProofStatus } | null;
}) {
  const [zoneOne, setZoneOne] = useState<File | null>(null);
  const [zoneTwo, setZoneTwo] = useState<File | null>(null);
  const [venue, setVenue] = useState<File | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sentStatus, setSentStatus] = useState<ProofStatus | null>(
    existing?.status === "rejected" ? null : existing?.status ?? null,
  );

  async function uploadSlot(
    supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>,
    file: File,
    slot: "zone-1" | "zone-2" | "venue",
  ) {
    const path = `${userId}/${eventId}/${slot}.${fileExt(file)}`;
    const { error } = await supabase.storage.from("proofs").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (error) {
      throw error;
    }
    return path;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zoneOneError = photoError(zoneOne, "zone photo 1");
    if (zoneOneError) {
      setErrorMessage(zoneOneError);
      return;
    }
    const zoneTwoError = photoError(zoneTwo, "zone photo 2");
    if (zoneTwoError) {
      setErrorMessage(zoneTwoError);
      return;
    }
    const venueError = photoError(venue, "venue photo");
    if (venueError) {
      setErrorMessage(venueError);
      return;
    }

    const site = normalizePostUrl(postUrl);
    if (postUrl.trim() && !looksLikeUrl(site)) {
      setErrorMessage("Enter a real post URL, or leave it blank.");
      return;
    }
    if (!zoneOne || !zoneTwo || !venue) {
      setErrorMessage("Upload 2 zone photos and 1 venue photo.");
      return;
    }

    const supabase = createBrowserSupabase();
    if (!supabase) {
      setErrorMessage("Auth is not configured yet.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const paths = [
        await uploadSlot(supabase, zoneOne, "zone-1"),
        await uploadSlot(supabase, zoneTwo, "zone-2"),
        await uploadSlot(supabase, venue, "venue"),
      ];

      const response = await fetch("/api/proofs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          files: paths,
          post_url: site || null,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save proof.");
      }

      console.log("Proof uploaded", eventId);
      setSentStatus("pending");
    } catch (error) {
      console.log("Proof upload failed", error);
      setErrorMessage("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // needs backend: proof is stored per event_id only, so the ticket shows
  // the event name, not the specific zone the mark is on.
  if (sentStatus === "pending" || sentStatus === "approved") {
    return (
      <div className="bib proof-ticket max-w-lg">
        <p className="proof-ticket-zone">{eventName}</p>
        <p className="proof-ticket-status">
          {sentStatus === "pending" ? "Pending" : "Approved"}
        </p>
        <p className="mt-2 text-[15px] text-muted">
          {sentStatus === "pending"
            ? "Proof sent. We check the photos, then payout can move."
            : "Proof sent."}
        </p>
      </div>
    );
  }

  return (
    <div className="bib proof-ticket max-w-lg">
      <p className="proof-ticket-zone">{eventName}</p>
      <p className="page-lead">
        Two photos of the mark on the correct zone. Face or bib must be
        visible. One photo at the venue. A post URL is optional.
      </p>
      <form onSubmit={handleSubmit} className="proof-ticket-form">
        <label className="block">
          <span className="field-label">Zone photo 1</span>
          <input
            className="field pt-2 text-[13px]"
            type="file"
            name="zone_one"
            accept="image/*"
            required
            onChange={(event) => setZoneOne(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Zone photo 2</span>
          <input
            className="field pt-2 text-[13px]"
            type="file"
            name="zone_two"
            accept="image/*"
            required
            onChange={(event) => setZoneTwo(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Venue photo</span>
          <input
            className="field pt-2 text-[13px]"
            type="file"
            name="venue"
            accept="image/*"
            required
            onChange={(event) => setVenue(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="mt-4 block">
          <span className="field-label">Post URL (optional)</span>
          <input
            className="field"
            name="post_url"
            inputMode="url"
            autoComplete="off"
            value={postUrl}
            onChange={(event) => setPostUrl(event.target.value)}
          />
        </label>
        {errorMessage ? (
          <p className="mt-4 text-[13px] text-danger">{errorMessage}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="cta-press cta-press-full mt-6"
        >
          <span className="cta-press-plate" aria-hidden="true" />
          <span className="cta-press-face">
            {busy ? "Uploading…" : "Submit proof"}
          </span>
        </button>
      </form>
    </div>
  );
}
