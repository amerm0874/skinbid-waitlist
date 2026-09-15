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
import { drawnPhotoZones, type ZoneRect } from "@/lib/zone-photos";

const EventCage = dynamic(() => import("@/components/cage/EventCage"), {
  ssr: false,
  loading: () => <div className="event-cage cage-loading" />,
});
const EMPTY_BIDS: Record<string, ZoneBidItem[]> = {};

export type StageZone = {
  id: string;
  name: ZoneName;
  status: "open" | "closed";
  occupied: boolean;
  current_cents: number | null;
  leadStatus?: "held" | "won" | null;
  brandId?: string | null;
  brandLabel?: string | null;
  brandWebsite?: string | null;
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
  savedRects?: Partial<Record<ZoneName, ZoneRect>> | null;
  useDefaultRects?: boolean;
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
  currentBrandId,
  zoneBids = EMPTY_BIDS,
  savedRects = null,
  useDefaultRects = false,
}: Props) {
  const router = useRouter();
  const [liveZones, setLiveZones] = useState(zones);
  const [liveBids, setLiveBids] = useState(zoneBids);
  const [previousZones, setPreviousZones] = useState(zones);
  const [previousBids, setPreviousBids] = useState(zoneBids);
  if (zones !== previousZones) {
    setPreviousZones(zones);
    setLiveZones(zones);
  }
  if (zoneBids !== previousBids) {
    setPreviousBids(zoneBids);
    setLiveBids(zoneBids);
  }
  const [selected, setSelected] = useState<ZoneName | null>(() =>
    SHOW_3D_BODY ? pickDefaultZone(zones, currentBrandId) : null,
  );
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const biddingRef = useRef(false);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [askCents, setAskCents] = useState(FLOOR_CENTS);
  const [lookNonce, setLookNonce] = useState(0);

  useEffect(() => {
    captureEvent("event_opened", { slug });
  }, [slug]);

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      setListOpen(false);
      if (!SHOW_3D_BODY) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clock = now;
  const zone = liveZones.find((item) => item.name === selected) ?? null;
  const open = isAuctionOpen(eventDate, new Date(clock));
  const minAsk = nextBidCents(zone?.current_cents ?? null);
  const amount = Math.max(askCents, minAsk);
  const wasOpen = useRef(isAuctionOpen(eventDate));

  useEffect(() => {
    if (wasOpen.current && !open) {
      router.refresh();
    }
    wasOpen.current = open;
  }, [open, router]);

  const selectedZoneId = zone?.id;
  useEffect(() => {
    if (!acceptsBids || !selectedZoneId || !isPersistedZoneId(selectedZoneId)) {
      return;
    }
    const zoneId = selectedZoneId;
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
  }, [acceptsBids, slug, selectedZoneId]);

  const brandCanAdvertise =
    canAdvertise ?? canAdvertiseOnEvent({ role, isOwner });

  function pickZone(name: ZoneName) {
    captureEvent("zone_clicked", { zone: name, slug });
    setSelected(name);
    setAskCents(FLOOR_CENTS);
    setMessage("");
    setListOpen(false);
    if (SHOW_3D_BODY) {
      setLookNonce((n) => n + 1);
    }
  }

  function clearZone() {
    setSelected(null);
    setMessage("");
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
      window.location.assign(loginHref);
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
      window.location.assign(payload.checkout_url);
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
  const visiblePhotoZones = new Set([
    ...drawnPhotoZones("front", { saved: savedRects, savedOnly: !useDefaultRects }),
    ...drawnPhotoZones("back", { saved: savedRects, savedOnly: !useDefaultRects }),
  ]);
  const saleRows = liveZones.filter((row) => row.status !== "closed" && (SHOW_3D_BODY || visiblePhotoZones.has(row.name)));

  const zoneRows = ZONE_NAMES.map((name) => {
    const row = liveZones.find((item) => item.name === name);
    const copy = zoneRowCopy(row, open);
    const athleteClosed = row?.status === "closed";
    return (
      <button
        key={name}
        type="button"
        aria-pressed={selected === name}
        disabled={athleteClosed}
        className={`zone-row${selected === name ? " is-on" : ""}${athleteClosed ? " is-closed" : ""}${copy.floor ? " is-floor" : ""}`}
        onClick={() => pickZone(name)}
      >
        <span className="zone-row-name">{copy.name}</span>
        <span className="zone-row-lead">{copy.lead}</span>
        <span className="zone-row-price">{copy.price}</span>
      </button>
    );
  });

  const meetRows = saleRows.map((row) => {
    const holder = row.occupied ? row.brandLabel?.trim() || "Bid placed" : "Open";
    const logo = row.logoUrl?.trim() || null;
    return (
      <button
        key={row.name}
        type="button"
        className="event-zones-row"
        aria-pressed={selected === row.name}
        onClick={() => pickZone(row.name)}
      >
        <span className="event-zones-row-copy">
          <span className="event-zones-row-zone">{ZONE_LABEL[row.name]}</span>
          <span className="event-zones-row-hold">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="event-zones-row-logo" />
            ) : null}
            {holder}
          </span>
        </span>
        <span className="event-zones-row-price">
          {centsToUsd(row.current_cents ?? FLOOR_CENTS)}
        </span>
      </button>
    );
  });

  const ownerBlock =
    isOwner && eventId && zone ? (
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
    ) : null;

  const holderName = zone
    ? zone.occupied
      ? zone.brandLabel?.trim() || "Bid placed"
      : zone.status === "closed"
        ? "Closed"
        : "Open"
    : "";
  const site = websiteParts(zone?.brandWebsite);
  const priceCopy =
    zone?.occupied && zone.current_cents
      ? centsToUsd(zone.current_cents)
      : `Open from ${centsToUsd(FLOOR_CENTS)}`;

  const sponsorSheet =
    !SHOW_3D_BODY && zone ? (
      <aside
        className="event-sponsor"
        role="region"
        aria-labelledby="event-sponsor-zone"
      >
        <div className="event-sponsor-head">
          <h2 id="event-sponsor-zone" className="event-sponsor-zone">
            {ZONE_LABEL[zone.name]}
          </h2>
          <button
            type="button"
            className="event-sponsor-close"
            aria-label="Close"
            onClick={clearZone}
          >
            ×
          </button>
        </div>
        <div className={`event-sponsor-mark${zone.logoUrl ? " is-filled" : ""}`}>
          {zone.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={zone.logoUrl} alt="" className="event-sponsor-logo" />
          ) : (
            <span className="event-sponsor-plus" aria-hidden="true">
              +
            </span>
          )}
        </div>
        <p className="event-sponsor-brand">{holderName}</p>
        {site ? (
          <a
            href={site.href}
            className="event-sponsor-site"
            target="_blank"
            rel="noreferrer"
          >
            {site.label}
          </a>
        ) : null}
        <div className="event-sponsor-foot">
          <p className="event-sponsor-price">{priceCopy}</p>
          {showAdvertise && zone.occupied ? (
            <div className="bid-stepper">
              <button type="button" className="bid-stepper-btn" aria-label="Lower bid" disabled={busy || amount <= minAsk} onClick={() => setAskCents(amount - BID_STEP_CENTS)}>−</button>
              <span className="bid-stepper-amt">{centsToUsd(amount)}</span>
              <button type="button" className="bid-stepper-btn" aria-label="Raise bid" disabled={busy} onClick={() => setAskCents(amount + BID_STEP_CENTS)}>+</button>
            </div>
          ) : null}
          {open && zone.status === "closed" && brandCanAdvertise ? (
            <p className="fine">Closed. No bid.</p>
          ) : null}
          {open && isDemo && brandCanAdvertise ? <BidGate /> : null}
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
                {busy
                ? "Opening checkout…"
                : `Bid ${centsToUsd(amount)} for ${ZONE_LABEL[zone.name]}`}
              </span>
            </button>
          ) : null}
          {showLogoDesk ? (
            <a
              href={logoDeskPath(slug)}
              className="event-logo-desk-link"
              onClick={() => captureEvent("logo_desk_opened", { slug })}
            >
              {zone.logoUrl ? "Replace logo" : "Upload logo"}
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
          {ownerBlock}
          {showAdvertise ? <p className="fine">You’ll continue to checkout to pay for your bid. Highest bid 48 hours before race day wins. Add your logo after payment.</p> : null}
        </div>
      </aside>
    ) : null;

  const bidBlock = (
    <>
      <p className="event-bid-status">
        {zone?.occupied && zone.brandLabel ? (
          <>
            {open ? "Leading bid" : "Highest bid"}{" "}
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
            {busy
              ? "Opening checkout…"
              : `Bid ${centsToUsd(amount)} for ${zone ? ZONE_LABEL[zone.name] : "this spot"}`}
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
      {ownerBlock}
      {isOwner && !isDemo && !SHOW_3D_BODY ? (
        <a href="/new" className="text-[13px] text-accent">
          Edit photos & slots
        </a>
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

  const meetHud = (
    <>
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
        {isOwner && !isDemo && !SHOW_3D_BODY ? (
          <a href="/new" className="event-hud-share">
            Edit photos & slots
          </a>
        ) : null}
      </div>
      <div className="event-hud-clock">
        <AuctionClock eventDate={eventDate} demo={isDemo} />
      </div>
    </>
  );

  const zoneSheet = listOpen ? (
    <div className="event-zones">
      <button
        type="button"
        className="event-zones-back"
        aria-label="Close zone list"
        onClick={() => setListOpen(false)}
      />
      <div
        className="event-zones-panel"
        role="dialog"
        aria-labelledby="zone-board-title"
      >
        <div className="event-zones-head">
          <h2 id="zone-board-title" className="event-zones-title">
            Zones
          </h2>
          <button
            type="button"
            className="event-zones-close"
            onClick={() => setListOpen(false)}
          >
            Close
          </button>
        </div>
        <div className="event-zones-list" aria-labelledby="zone-board-title">
          {meetRows}
        </div>
      </div>
    </div>
  ) : null;

  if (SHOW_3D_BODY) {
    return (
      <div className="event-stage">
        <div className="event-cage-wrap">
          {zoneSheet}
          <EventCage
            glbUrl={glbUrl}
            zones={liveZones}
            selected={selected}
            onSelect={pickZone}
            lookNonce={lookNonce}
          />
          <div className="event-hud">
            {meetHud}
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

  return (
    <main className="event-stage studio-stage">
      <header className="studio-top">
        <div>
          <nav className="studio-breadcrumb" aria-label="Breadcrumb"><EventLink href="/events">Events</EventLink><span aria-hidden="true">/</span>{profileHref ? <EventLink href={profileHref}>{athleteName}</EventLink> : <span>{athleteName}</span>}<span aria-hidden="true">/</span><span>Placements</span></nav>
          <h1>Sponsor {athleteName}</h1>
          <p>{eventName} · {when}</p>
        </div>
        <AuctionClock eventDate={eventDate} demo={isDemo} />
      </header>
      <div className="studio-layout">
      <div className="studio-canvas">
        <PhotoStage
          frontUrl={frontPhotoUrl}
          backUrl={backPhotoUrl}
          zones={liveZones}
          selected={selected}
          onSelect={pickZone}
          onClear={clearZone}
          athleteName={athleteName}
          savedRects={savedRects}
          useDefaultRects={useDefaultRects}
        />
      </div>
      <section className="studio-rail" aria-label="Sponsorship placements">
        <h2>{open ? "Choose your placement" : "Race-day sponsors"}</h2>
        <p className="studio-rail-intro">Every placement is positioned by the athlete. Choose a marked area to see its price.</p>
        <div className="studio-zone-list">{meetRows.length ? meetRows : <p className="studio-rail-intro">No placements are available for this event yet.</p>}</div>
        {sponsorSheet}
        {!zone ? <div className="studio-help"><strong>{saleRows.length ? "Your logo, on the start line." : "The athlete sets the positions."}</strong>{saleRows.length ? "Choose a placement to see the price. After payment, upload your logo and preview it on the athlete." : "There are no automatically generated body slots. Placements appear after the athlete positions them on their own photos."}</div> : null}
        {isOwner && !isDemo ? <div className="studio-help"><a href="/new">Edit photos & placements</a>{eventId ? <><br /><a href={`/proof/${eventId}`}>Upload race-day proof</a></> : null}</div> : null}
      </section>
      </div>
    </main>
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
      next: "",
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
    next: "",
    floor: !row?.current_cents && !athleteClosed,
  };
}

function websiteParts(raw: string | null | undefined) {
  const value = (raw ?? "").trim();
  if (!value) {
    return null;
  }
  const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    if (!host.includes(".")) {
      return null;
    }
    return { href, label: host };
  } catch {
    return null;
  }
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
