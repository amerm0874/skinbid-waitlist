"use client";

import { FormEvent, useState } from "react";

type Brand = {
  id: string;
  name: string | null;
  website: string | null;
  brand_category: string | null;
};

export default function OutreachForm({ brands }: { brands: Brand[] }) {
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [eventName, setEventName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, event_name: eventName }),
      });
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
        stored?: string;
      };
      if (!response.ok) {
        setMessage(payload.error || "Email did not send.");
        return;
      }
      console.log("Outreach email queued", payload.stored ?? "sent");
      setMessage(
        payload.stored === "log"
          ? "No email key yet. Request stored in the server log."
          : "SkinBid emailed that brand. They reply to us, not you.",
      );
    } catch (error) {
      console.log("Outreach failed", error);
      setMessage("Email did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-shell">
      <label className="block">
        <span className="field-label">Brand</span>
        <select
          className="field"
          name="brand_id"
          autoComplete="off"
          required
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
        >
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name ?? "Brand"} {brand.brand_category ? `· ${brand.brand_category}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="field-label">Your event</span>
        <input
          className="field"
          name="event_name"
          autoComplete="off"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy || !brandId} className="btn btn-solid mt-5">
        {busy ? "Sending…" : "Ask SkinBid to email them"}
      </button>
      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </form>
  );
}
