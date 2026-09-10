"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";

const initialZones = Object.fromEntries(
  ZONE_NAMES.map((name) => [name, "open"]),
) as Record<ZoneName, "open" | "closed">;

export default function NewEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [sport, setSport] = useState("");
  const [likeness, setLikeness] = useState(false);
  const [appearance, setAppearance] = useState("");
  const [zones, setZones] = useState(initialZones);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          date,
          city,
          sport,
          likeness_opt_in: likeness,
          appearance_price_cents: appearance
            ? Math.round(Number(appearance) * 100)
            : null,
          zones,
        }),
      });
      const payload = (await response.json()) as { error?: string; slug?: string };
      if (!response.ok || !payload.slug) {
        setErrorMessage(payload.error || "Could not create the event.");
        return;
      }
      console.log("Event created", payload.slug);
      router.push(`/e/${payload.slug}`);
    } catch (error) {
      console.log("Event create failed", error);
      setErrorMessage("Could not create the event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      <label className="block">
        <span className="field-label">Event name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="mt-4 block">
        <span className="field-label">Date (4 days to 3 months out)</span>
        <input className="field" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="mt-4 block">
        <span className="field-label">City</span>
        <input className="field" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <label className="mt-4 block">
        <span className="field-label">Sport</span>
        <input className="field" value={sport} onChange={(e) => setSport(e.target.value)} />
      </label>

      <p className="field-label mt-6">Zones — close any you cannot sell. No custom names.</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ZONE_NAMES.map((zone) => (
          <li key={zone}>
            <button
              type="button"
              className={`flex h-11 w-full items-center justify-between border px-3 text-[13px] ${
                zones[zone] === "open"
                  ? "border-accent text-ink"
                  : "border-line text-muted"
              }`}
              onClick={() =>
                setZones((current) => ({
                  ...current,
                  [zone]: current[zone] === "open" ? "closed" : "open",
                }))
              }
            >
              {ZONE_LABEL[zone]}
              <span className="font-mono text-[10px] uppercase">
                {zones[zone]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <label className="mt-6 flex items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          checked={likeness}
          onChange={(e) => setLikeness(e.target.checked)}
          className="mt-1"
        />
        <span>
          Likeness reuse off unless you opt in here and set a separate appearance
          price. Slot photos of event day are included either way.
        </span>
      </label>
      {likeness ? (
        <label className="mt-4 block">
          <span className="field-label">Appearance price (USD, separate)</span>
          <input
            className="field"
            type="number"
            min={1}
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
          />
        </label>
      ) : null}

      {errorMessage ? <p className="mt-4 text-[13px] text-danger">{errorMessage}</p> : null}
      <button type="submit" disabled={busy} className="btn btn-solid mt-6">
        {busy ? "Publishing…" : "Publish event"}
      </button>
    </form>
  );
}
