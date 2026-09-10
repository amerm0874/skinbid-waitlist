"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CageZone } from "@/components/cage/EventCage";
import { auctionClosesAt, isAuctionOpen } from "@/lib/auction";
import { centsToUsd, nextBidCents } from "@/lib/money";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";

const EventCage = dynamic(() => import("@/components/cage/EventCage"), {
  ssr: false,
});

export type StageZone = CageZone & {
  id: string;
  current_cents: number | null;
};

type Props = {
  slug: string;
  athleteName: string;
  eventName: string;
  eventDate: string;
  glbUrl: string;
  zones: StageZone[];
  canBid: boolean;
  loginHref: string;
};

export default function EventStage({
  slug,
  athleteName,
  eventName,
  eventDate,
  glbUrl,
  zones,
  canBid,
  loginHref,
}: Props) {
  const [selected, setSelected] = useState<ZoneName | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const zone = zones.find((item) => item.name === selected) ?? null;
  const open = isAuctionOpen(eventDate);
  const closeAt = auctionClosesAt(eventDate);
  const amount = nextBidCents(zone?.current_cents ?? null);

  const cageZones = useMemo(() => zones, [zones]);

  async function bid() {
    if (!zone) {
      setMessage("Tap a zone.");
      return;
    }
    if (zone.status === "closed") {
      setMessage("Athlete closed this zone.");
      return;
    }
    if (!open) {
      setMessage("Auction is closed.");
      return;
    }
    if (!canBid) {
      setMessage("Log in as a brand to bid.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          zone_id: zone.id,
          zone_name: zone.name,
          amount_cents: amount,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        checkout_url?: string;
      };
      if (!response.ok || !payload.checkout_url) {
        setMessage(payload.error || "Bid did not start.");
        return;
      }
      console.log("Dodo checkout opened", zone.name, amount);
      window.location.href = payload.checkout_url;
    } catch (error) {
      console.log("Bid failed", error);
      setMessage("Bid did not start.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px]">
      <EventCage
        glbUrl={glbUrl}
        zones={cageZones}
        selected={selected}
        onSelect={setSelected}
      />
      <aside className="flex flex-col gap-4 border-t border-line p-4 md:border-t-0 md:p-6">
        <p className="eyebrow">{athleteName}</p>
        <h1 className="display text-[36px] leading-none">{eventName}</h1>
        <p className="font-mono text-[12px] text-muted">
          {new Date(eventDate).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <Countdown to={closeAt.toISOString()} />
        <p className="text-[13px] text-muted">
          Drag to rotate. Scroll to zoom. Tap a zone.
        </p>
        <label className="block">
          <span className="field-label">Zone</span>
          <select
            className="field"
            value={selected ?? ""}
            onChange={(event) =>
              setSelected((event.target.value as ZoneName) || null)
            }
          >
            <option value="">Select</option>
            {ZONE_NAMES.map((name) => (
              <option key={name} value={name}>
                {ZONE_LABEL[name]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[15px]">
          Current bid:{" "}
          <span className="font-semibold">
            {zone?.current_cents ? centsToUsd(zone.current_cents) : "—"}
          </span>
        </p>
        <p className="text-[15px]">
          Your bid: <span className="font-semibold">{centsToUsd(amount)}</span>
        </p>
        <button
          type="button"
          className="btn btn-solid"
          disabled={busy || !zone}
          onClick={bid}
        >
          {busy ? "Opening checkout…" : "Bid"}
        </button>
        {!canBid ? (
          <a href={loginHref} className="text-[13px] text-accent">
            Log in as a brand
          </a>
        ) : null}
        {message ? <p className="text-[13px] text-danger">{message}</p> : null}
        <p className="text-[12px] text-muted">
          Paying takes the lead. Someone can still take it until T–48h. Outbid
          brands are refunded in full.
        </p>
      </aside>
    </div>
  );
}

function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
    };
  }, []);

  if (now == null) {
    return (
      <p className="font-mono text-[13px] text-accent">Auction close —</p>
    );
  }

  const remain = Math.max(0, target - now);
  const days = Math.floor(remain / 86_400_000);
  const hours = Math.floor((remain % 86_400_000) / 3_600_000);
  const mins = Math.floor((remain % 3_600_000) / 60_000);
  const secs = Math.floor((remain % 60_000) / 1000);
  const label =
    days > 0
      ? `${days}d ${hours}h ${mins}m ${secs}s`
      : `${hours}h ${mins}m ${secs}s`;
  return (
    <p className="font-mono text-[13px] text-accent">Auction close {label}</p>
  );
}
