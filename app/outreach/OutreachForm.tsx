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
      const payload = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setMessage(payload.error || "Email did not send.");
        return;
      }
      console.log("Outreach email queued");
      setMessage("SkinBid emailed that brand. They reply to us, not you.");
    } catch (error) {
      console.log("Outreach failed", error);
      setMessage("Email did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <label className="block">
        <span className="field-label">Brand</span>
        <select
          className="field"
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
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="City marathon, 12 Oct"
        />
      </label>
      <button type="submit" disabled={busy || !brandId} className="btn btn-solid mt-5">
        {busy ? "Sending…" : "Ask SkinBid to email them"}
      </button>
      {message ? <p className="mt-4 text-[14px] text-muted">{message}</p> : null}
    </form>
  );
}
