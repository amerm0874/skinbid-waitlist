"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { formatEventStartLabel, isAuctionOpen } from "@/lib/auction";
import { logoDownloadName } from "@/lib/athlete-status";
import { canAdvertiseOnEvent, BID_STEP_CENTS, FLOOR_CENTS } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { athleteProfilePath } from "@/lib/handle";
import { logoDeskPath } from "@/lib/logo";
import { centsToUsd, nextBidCents } from "@/lib/money";
import type { BidStatus } from "@/lib/types";
import { isPersistedZoneId, type ZoneBidItem } from "@/lib/zone-bids";
import { featuredSlot, ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { captureEvent, captureException } from "@/lib/analytics";
import { SHOW_3D_BODY } from "@/lib/feature-flags";
import PhotoStage from "@/components/product/PhotoStage";
import { AuctionClock } from "@/components/product/AuctionClock";
import { CopyLinkButton } from "@/components/product/CopyLinkButton";
import { DownloadLogo } from "@/components/product/DownloadLogo";
import { BidGate } from "@/components/product/BidGate";
import { EventLink } from "@/components/product/EventLink";
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
  athleteHandle?: string | null;
  eventName: string;
  eventDate: string;
  glbUrl: string;
  frontPhotoUrl?: string | null;
  backPhotoUrl?: string | null;
  zones: StageZone[];
  canBid: boolean;
  role?: "athlete" | "brand" | null;
  acceptsBids?: boolean;
  canAdvertise?: boolean;
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
  athleteHandle,
  eventName,
  eventDate,
  glbUrl,
  frontPhotoUrl = null,
  backPhotoUrl = null,
  zones,
  canBid,
  role,
  acceptsBids = true,
  canAdvertise,
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
  const biddingRef = useRef(false);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [askCents, setAskCents] = useState(FLOOR_CENTS);
  const [lookNonce, setLookNonce] = useState(0);

  useEffect(() => {
    captureEvent("event_opened", { slug });
  }, [slug]);

  useEffect(() => {
    setLiveZones(zones);
  }, [zones]);

  useEffect(() => {
    setLiveBids(zoneBids);
  }, [zoneBids]);

  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("bid_id");
    if (!paid) {
      return;
    }
    captureEvent("checkout_returned", { slug, bid_id: paid, kind: "bid" });
    captureEvent("bid_paid_returned", { slug, bid_id: paid });
    window.location.replace(logoDeskPath(slug, paid));
  }, [slug]);

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
  const minAsk = nextBidCents(zone?.current_cents ?? null);
  const amount = Math.max(askCents, minAsk);
  const wasOpen = useRef(isAuctionOpen(eventDate));

  useEffect(() => {
    setAskCents(minAsk);
  }, [zone?.id, minAsk]);

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

  const brandCanAdvertise =
    canAdvertise ?? canAdvertiseOnEvent({ role, isOwner });

  function pickZone(name: ZoneName) {
    captureEvent("zone_clicked", { zone: name, slug });
    setSelected(name);
    setLookNonce((n) => n + 1);
  }

  async function bid() {
    if (busy || biddingRef.current) {
      return;
    }
    if (!brandCanAdvertise) {
      setMessage("Only brands bid.");
      return;
    }
    if (!acceptsBids) {
      setMessage("Demo — bidding is not open.");
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
    captureEvent("bid_clicked", {
      slug,
      zone: zone.name,
      amount_cents: amount,
    });
    if (!canBid) {
      window.location.href = loginHref;
      return;
    }
    biddingRef.current = true;
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
        logo_path?: string;
      };
      if (!response.ok) {
        setMessage(payload.error || "Bid did not land.");
        biddingRef.current = false;
        setBusy(false);
        return;
      }
      if (!payload.checkout_url) {
        setMessage("Payments are not ready.");
        biddingRef.current = false;
        setBusy(false);
        return;
      }
      captureEvent("checkout_opened", {
        slug,
        zone: zone.name,
        kind: "bid",
      });
      window.location.href = payload.checkout_url;
    } catch (error) {
      console.log("Bid failed", error);
      captureException(error);
      setMessage("Bid did not land.");
      biddingRef.current = false;
      setBusy(false);
    }
  }

  const isDemo = slug === DEMO_SLUG;
  const wonThisZone = Boolean(
    currentBrandId && zone?.occupied && zone.brandId === currentBrandId,
  );
  const showLogoDesk = brandCanAdvertise && !isDemo && wonThisZone;
  const showAdvertise =
    brandCanAdvertise && acceptsBids && zone?.status === "open" && open;

  const when = formatEventStartLabel(eventDate);
  const profileHref = athleteProfilePath(athleteHandle);

  const zoneRows = ZONE_NAMES.map((name) => {
    const row = liveZones.find((item) => item.name === name);
    const copy = zoneRowCopy(row, open);
    const athleteClosed = row?.status === "closed";
    return (
      <button
        key={name}
        type="button"
        aria-pressed={selected === name}
        className={`zone-row${selected === name ? " is-on" : ""}${athleteClosed ? " is-closed" : ""}${copy.floor ? " is-floor" : ""}`}
        onClick={() => pickZone(name)}
      >
        <span className="zone-row-name">{copy.name}</span>
        <span className="zone-row-lead">{copy.lead}</span>
        <span className="zone-row-price">{copy.price}</span>
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
      {open && zone?.status === "closed" && brandCanAdvertise ? (
        <p className="fine">Closed. No bid.</p>
      ) : null}
      {open && isDemo && brandCanAdvertise ? <BidGate /> : null}
      {showAdvertise && zone?.occupied ? (
        <div className="bid-stepper">
          <button
            type="button"
            className="bid-stepper-btn"
            aria-label="Lower bid"
            disabled={busy || amount <= minAsk}
            onClick={() => setAskCents(amount - BID_STEP_CENTS)}
          >
            −
          </button>
          <span className="bid-stepper-amt">{centsToUsd(amount)}</span>
          <button
            type="button"
            className="bid-stepper-btn"
            aria-label="Raise bid"
            disabled={busy}
            onClick={() => setAskCents(amount + BID_STEP_CENTS)}
          >
            +
          </button>
        </div>
      ) : null}
      {showAdvertise ? (
        <button
          type="button"
          className="cta-press cta-press-full"
          data-attr="Advertise"
          disabled={busy}
          onClick={() => void bid()}
        >
          <span className="cta-press-plate" aria-hidden="true" />
          <span className="cta-press-face">
            {busy ? "Opening Whop…" : `Advertise ${centsToUsd(amount)}`}
          </span>
        </button>
      ) : null}
      {showLogoDesk ? (
        <a
          href={logoDeskPath(slug)}
          className="event-logo-desk-link"
          onClick={() => captureEvent("logo_desk_opened", { slug })}
        >
          {zone?.logoUrl ? "Replace logo" : "Upload logo"}
        </a>
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
          Floor $100, then +$100. Highest bid 48 hours before the event wins.
          Same category cannot take a second zone.
        </p>
      ) : showAdvertise ? (
        <p className="fine bid-rules">
          Floor $100, then +$100. Highest bid 48 hours before the event wins.
        </p>
      ) : null}
    </>
  );

  const showDock =
    Boolean(message) ||
    showAdvertise ||
    showLogoDesk ||
    (isDemo && brandCanAdvertise) ||
    Boolean(isOwner);

  return (
    <div className="event-stage">
      <div className="event-cage-wrap">
        {SHOW_3D_BODY ? (
          <EventCage
            glbUrl={glbUrl}
            zones={liveZones}
            selected={selected}
            onSelect={pickZone}
            lookNonce={lookNonce}
          />
        ) : (
          <PhotoStage
            frontUrl={frontPhotoUrl}
            backUrl={backPhotoUrl}
            zones={liveZones}
            selected={selected}
            onSelect={pickZone}
            athleteName={athleteName}
            frameNonce={lookNonce}
          />
        )}
        <div className="event-hud">
          <div className="event-hud-ask">
            <h1 className="event-hud-meet display">
              {profileHref ? (
                <EventLink href={profileHref}>{athleteName}</EventLink>
              ) : (
                athleteName
              )}
            </h1>
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
            <AuctionClock eventDate={eventDate} demo={isDemo} />
          </div>
          <div className="event-hud-floor">
            <div className="zone-board">
              <h2 id="zone-board-title" className="zone-board-title">
                {zoneBoardTitle(open)}
              </h2>
              <div className="zone-list" aria-labelledby="zone-board-title">
                {zoneRows}
              </div>
              {showDock ? (
                <div className="event-hud-dock">
                  <div className="event-bid">{bidBlock}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function zoneBoardTitle(auctionOpen: boolean) {
  return auctionOpen ? "Zones" : "Meet the sponsors";
}

function zoneRowCopy(row: StageZone | undefined, auctionOpen: boolean) {
  const name = ZONE_LABEL[row?.name ?? "chest_l"];
  const winner = row?.occupied ? row.brandLabel?.trim() || null : null;
  const sold = Boolean(winner && row?.current_cents);
  if (!auctionOpen) {
    return {
      name,
      lead: winner ?? "",
      price: sold ? centsToUsd(row!.current_cents!) : "",
      floor: false,
    };
  }
  const athleteClosed = row?.status === "closed";
  return {
    name,
    lead: winner ?? (athleteClosed ? "Closed" : "Open"),
    price: row?.current_cents
      ? centsToUsd(row.current_cents)
      : athleteClosed
        ? ""
        : centsToUsd(FLOOR_CENTS),
    floor: !row?.current_cents && !athleteClosed,
  };
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

function isStageNotice(message: string) {
  return (
    message === "You're the lead." ||
    message === "Zone closed." ||
    message === "Zone reopened." ||
    message.startsWith("Payment received")
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
