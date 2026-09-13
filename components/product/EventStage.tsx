"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { auctionClosesAt, isAuctionOpen } from "@/lib/auction";
import { logoDownloadName } from "@/lib/athlete-status";
import { FLOOR_CENTS } from "@/lib/config";
import { logoClientError } from "@/lib/logo";
import { centsToUsd, nextBidCents } from "@/lib/money";
import type { BidStatus } from "@/lib/types";
import { isPersistedZoneId, type ZoneBidItem } from "@/lib/zone-bids";
import { featuredSlot, ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { BidGate } from "@/components/product/BidGate";
import { CopyLinkButton } from "@/components/product/CopyLinkButton";
import { DownloadLogo } from "@/components/product/DownloadLogo";
import { EventZoneOwnerAction } from "@/components/product/ZoneStatusControls";

const EventCage = dynamic(() => import("@/components/cage/EventCage"), {
  ssr: false,
  loading: () => <div className="event-cage cage-loading" />,
});

export type StageZone = {
  id: string;
  name: ZoneName;
  status: "open" | "closed";
  occupied: boolean;
  current_cents: number | null;
  leadStatus?: "held" | "won" | null;
  brandId?: string | null;
  brandLabel?: string | null;
  logoUrl?: string | null;
};

type Props = {
  slug: string;
  eventId?: string;
  athleteName: string;
  eventName: string;
  eventDate: string;
  glbUrl: string;
  zones: StageZone[];
  canBid: boolean;
  role?: "athlete" | "brand" | null;
  acceptsBids?: boolean;
  paymentsReady?: boolean;
  isOwner?: boolean;
  loginHref: string;
  brandName?: string | null;
  currentBrandId?: string | null;
  brandLogoUrl?: string | null;
  zoneBids?: Record<string, ZoneBidItem[]>;
};

export default function EventStage({
  slug,
  eventId,
  athleteName,
  eventName,
  eventDate,
  glbUrl,
  zones,
  canBid,
  role,
  acceptsBids = true,
  paymentsReady = false,
  isOwner,
  loginHref,
  brandName,
  currentBrandId,
  brandLogoUrl,
  zoneBids = {},
}: Props) {
  const router = useRouter();
  const [liveZones, setLiveZones] = useState(zones);
  const [liveBids, setLiveBids] = useState(zoneBids);
  const [selected, setSelected] = useState<ZoneName | null>(() =>
    pickDefaultZone(zones, currentBrandId),
  );
  const [busy, setBusy] = useState(false);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setLiveZones(zones);
  }, [zones]);

  useEffect(() => {
    setLiveBids(zoneBids);
  }, [zoneBids]);

  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("checkout_id");
    if (!paid) {
      return;
    }
    setMessage("Payment received. Lead updates when Polar confirms.");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
    };
  }, []);

  const clock = now == null ? Date.now() : now;
  const zone = liveZones.find((item) => item.name === selected) ?? null;
  const open = isAuctionOpen(eventDate, new Date(clock));
  const closeAt = auctionClosesAt(eventDate);
  const amount = nextBidCents(zone?.current_cents ?? null);
  const wasOpen = useRef(isAuctionOpen(eventDate));

  useEffect(() => {
    if (wasOpen.current && !open) {
      router.refresh();
    }
    wasOpen.current = open;
  }, [open, router]);

  useEffect(() => {
    if (!acceptsBids || !zone || !isPersistedZoneId(zone.id)) {
      return;
    }
    const zoneId = zone.id;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/bids?slug=${encodeURIComponent(slug)}&zone_id=${encodeURIComponent(zoneId)}`,
        );
        const payload = (await response.json()) as { bids?: ZoneBidItem[] };
        if (cancelled || !response.ok || !payload.bids) {
          return;
        }
        setLiveBids((current) => ({ ...current, [zoneId]: payload.bids ?? [] }));
      } catch (error) {
        console.log("Bid list failed", error);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [acceptsBids, slug, zone?.id]);

  async function bid() {
    if (!acceptsBids) {
      setMessage("This preview does not take bids.");
      return;
    }
    if (!canBid) {
      if (role === "athlete") {
        setMessage("Only brands bid.");
        return;
      }
      window.location.href = loginHref;
      return;
    }
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
        bid_id?: string;
        status?: string;
        amount_cents?: number;
        checkout_url?: string;
      };
      if (!response.ok) {
        setMessage(payload.error || "Bid did not land.");
        return;
      }
      if (payload.checkout_url) {
        window.location.href = payload.checkout_url;
        return;
      }
      console.log("Bid held", zone.name, payload.amount_cents);
      const nextBid: ZoneBidItem = {
        id: payload.bid_id ?? `local-${Date.now()}`,
        brandName: brandName || "You",
        amountCents: payload.amount_cents ?? amount,
        createdAt: new Date().toISOString(),
        status: isBidStatus(payload.status) ? payload.status : "held",
      };
      setLiveZones((current) =>
        current.map((item) =>
          item.id === zone.id
            ? {
                ...item,
                occupied: true,
                current_cents: payload.amount_cents ?? amount,
                brandId: currentBrandId ?? item.brandId,
                brandLabel: brandName || item.brandLabel || "You",
                logoUrl: item.logoUrl || brandLogoUrl || null,
              }
            : item,
        ),
      );
      setLiveBids((current) => ({
        ...current,
        [zone.id]: [
          nextBid,
          ...(current[zone.id] ?? []).filter((row) => row.id !== nextBid.id),
        ].slice(0, 10),
      }));
      setMessage("You're the lead.");
      router.refresh();
    } catch (error) {
      console.log("Bid failed", error);
      setMessage("Bid did not land.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!zone) {
      setMessage("Tap a zone.");
      return;
    }
    if (!isPersistedZoneId(zone.id)) {
      setMessage("This preview does not take logos.");
      return;
    }
    const invalid = logoClientError(file);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    setLogoBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("zone_id", zone.id);
      body.set("file", file);
      const response = await fetch("/api/bids/logo", {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        error?: string;
        logo_url?: string;
      };
      if (!response.ok || !payload.logo_url) {
        setMessage(payload.error || "Logo did not save.");
        return;
      }
      console.log("Logo saved", zone.name);
      setLiveZones((current) =>
        current.map((item) =>
          item.id === zone.id
            ? {
                ...item,
                occupied: true,
                brandId: currentBrandId ?? item.brandId,
                brandLabel: brandName || item.brandLabel || "You",
                logoUrl: payload.logo_url ?? item.logoUrl,
              }
            : item,
        ),
      );
      setMessage("Logo is on the zone.");
      router.refresh();
    } catch (error) {
      console.log("Logo upload failed", error);
      setMessage("Logo did not save.");
    } finally {
      setLogoBusy(false);
    }
  }

  const canUploadLogo = Boolean(
    currentBrandId &&
      zone?.occupied &&
      zone.brandId === currentBrandId &&
      isPersistedZoneId(zone.id),
  );

  const when = new Date(eventDate).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const zoneRows = ZONE_NAMES.map((name) => {
    const row = liveZones.find((item) => item.name === name);
    const closed = row?.status === "closed";
    const lead = row?.occupied ? row.brandLabel : null;
    const price = row?.current_cents
      ? centsToUsd(row.current_cents)
      : closed
        ? "closed"
        : centsToUsd(FLOOR_CENTS);
    return (
      <button
        key={name}
        type="button"
        aria-pressed={selected === name}
        className={`zone-row${selected === name ? " is-on" : ""}${closed ? " is-closed" : ""}${!row?.current_cents && !closed ? " is-floor" : ""}`}
        onClick={() => setSelected(name)}
      >
        <span className="zone-row-price">{price}</span>
        <span className="zone-row-name">{ZONE_LABEL[name]}</span>
        <span className="zone-row-lead">
          {lead ?? (closed ? "closed" : "open")}
        </span>
      </button>
    );
  });

  const bidBlock = (
    <>
      <p className="event-bid-status">
        {zone?.occupied && zone.brandLabel ? (
          <>
            {open ? "Lead" : "Won"}{" "}
            {zone.logoUrl ? (
              // User PNG from the logos bucket. next/image needs a fixed host list.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={zone.logoUrl}
                alt=""
                className="event-logo-inline"
              />
            ) : null}
            <span className="font-semibold">{zone.brandLabel}</span>
          </>
        ) : zone?.status === "closed" ? (
          <>Closed</>
        ) : (
          <>Open</>
        )}
      </p>
      {!isOwner ? <BidGate slug={slug} /> : null}
      {canUploadLogo ? (
        <label className="event-logo-upload">
          <span className="field-label">
            {zone?.logoUrl ? "Replace zone logo" : "Upload zone logo"}
          </span>
          {zone?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zone.logoUrl}
              alt=""
              className="event-logo-preview"
            />
          ) : null}
          <input
            className="field"
            type="file"
            name="logo"
            accept="image/png"
            disabled={logoBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              if (file) {
                void uploadLogo(file);
              }
            }}
          />
          <span className="fine">
            {logoBusy
              ? "Saving logo…"
              : "Transparent PNG, max 2 MB. It sits on this zone."}
          </span>
        </label>
      ) : null}
      {message ? (
        <p
          className={
            isStageNotice(message)
              ? "text-[13px] text-accent"
              : "text-[13px] text-danger"
          }
        >
          {message}
        </p>
      ) : null}
      {isOwner && eventId && !zone ? (
        <p className="fine">Tap a zone to close or reopen it.</p>
      ) : null}
      {isOwner && eventId && zone ? (
        zone.logoUrl &&
        (zone.leadStatus === "won" || (!open && zone.occupied)) ? (
          <DownloadLogo
            href={zone.logoUrl}
            zoneLabel={ZONE_LABEL[zone.name]}
            fileName={logoDownloadName(zone.name)}
          />
        ) : (
          <EventZoneOwnerAction
            zone={{
              id: zone.id,
              name: zone.name,
              status: zone.status,
              occupied: zone.occupied,
              currentCents: zone.current_cents,
              leadStatus: zone.leadStatus ?? null,
            }}
            eventDate={eventDate}
            now={new Date(clock)}
            busy={zoneBusy}
            onBusy={setZoneBusy}
            onStatus={(status) => {
              setLiveZones((current) =>
                current.map((item) =>
                  item.id === zone.id ? { ...item, status } : item,
                ),
              );
              router.refresh();
            }}
            onMessage={setMessage}
          />
        )
      ) : null}
      {isOwner && eventId ? (
        <a href={`/proof/${eventId}`} className="text-[13px] text-accent">
          Upload proof
        </a>
      ) : null}
      {isOwner && zone ? <BidLog bids={liveBids[zone.id] ?? []} /> : null}
      {isOwner ? (
        <p className="fine bid-rules">
          Floor $100, then +$100. You pay SkinBid later. Highest bid 48 hours
          before the event wins. Same category cannot take a second zone.
        </p>
      ) : null}
    </>
  );

  const askCents =
    zone?.current_cents ?? (zone?.status === "closed" ? null : FLOOR_CENTS);
  const askPrice = askCents != null ? centsToUsd(askCents) : "closed";
  const askName = zone ? ZONE_LABEL[zone.name] : "Zone";
  const askLead =
    zone?.occupied && zone.brandLabel
      ? zone.brandLabel
      : zone?.status === "closed"
        ? "closed"
        : "open";

  return (
    <div className="event-stage">
      <div className="event-cage-wrap">
        <EventCage
          glbUrl={glbUrl}
          zones={liveZones}
          selected={selected}
          onSelect={setSelected}
        />
        <div className="event-hud">
          <div className="event-hud-ask">
            <p className="event-hud-zone">{askName}</p>
            <p className="event-hud-price">{askPrice}</p>
            <p className="event-hud-lead">{askLead}</p>
            <h1 className="event-hud-meet display">{athleteName}</h1>
            <p className="event-hud-meet-sub">
              {eventName} · {when}
            </p>
            <CopyLinkButton
              path={`/e/${slug}`}
              title={`${athleteName} · ${eventName}`}
              className="event-hud-share"
            />
          </div>
          <div className="event-hud-clock">
            <Countdown to={closeAt.toISOString()} />
          </div>
          <div className="event-hud-floor">
            <div className="event-hud-tape">
              <div className="zone-list">{zoneRows}</div>
            </div>
            <div className="event-hud-dock">
              <div className="event-bid">{bidBlock}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pickDefaultZone(
  zones: StageZone[],
  currentBrandId?: string | null,
): ZoneName | null {
  if (currentBrandId) {
    const mine = zones.find(
      (item) => item.occupied && item.brandId === currentBrandId,
    );
    if (mine) {
      return mine.name;
    }
  }
  return featuredSlot(zones).name;
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
    return <p className="countdown">—</p>;
  }

  const remain = Math.max(0, target - now);
  if (remain <= 0) {
    return <p className="countdown is-closed">Closed</p>;
  }

  const days = Math.floor(remain / 86_400_000);
  const hours = Math.floor((remain % 86_400_000) / 3_600_000);
  const mins = Math.floor((remain % 3_600_000) / 60_000);
  const secs = Math.floor((remain % 60_000) / 1000);
  const hh = String(hours).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  const label = days > 0 ? `${days}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  return <p className="countdown">{label}</p>;
}

function isStageNotice(message: string) {
  return (
    message === "You're the lead." ||
    message === "Logo is on the zone." ||
    message === "Zone closed." ||
    message === "Zone reopened." ||
    message.startsWith("Payment received")
  );
}

function isBidStatus(value: string | undefined): value is BidStatus {
  return (
    value === "pending" ||
    value === "held" ||
    value === "refunded" ||
    value === "won" ||
    value === "failed"
  );
}

function bidTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bidStatusLabel(status: BidStatus) {
  // "Outbid" reads clearer than "Refunded" for a lapsed bid. The DB value
  // (and the is-refunded class it drives) is unchanged.
  return status === "refunded" ? "Outbid" : status;
}

function BidLog({ bids }: { bids: ZoneBidItem[] }) {
  if (!bids.length) {
    return <p className="bid-log-empty">No bids on this zone yet.</p>;
  }
  return (
    <ol className="bid-log">
      {bids.map((bid) => (
        <li key={bid.id} className="bid-log-row">
          <span className="bid-log-brand">{bid.brandName}</span>
          <span className="bid-log-amount">{centsToUsd(bid.amountCents)}</span>
          <span className="bid-log-time">{bidTime(bid.createdAt)}</span>
          <span className={`bid-log-status is-${bid.status}`}>
            {bidStatusLabel(bid.status)}
          </span>
        </li>
      ))}
    </ol>
  );
}
