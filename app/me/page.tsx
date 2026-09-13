import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import {
  athleteEventStatus,
  type ProofStatus,
} from "@/lib/athlete-status";
import { closeEventAuction } from "@/lib/close-auctions";
import { sessionGateRedirect } from "@/lib/config";
import { demoteLiveWithoutReadyGlb } from "@/lib/event-create";
import { loadLiveSlotCards, type LiveSlotCard as LiveSlotCardRow } from "@/lib/live-listings";
import { centsToUsd } from "@/lib/money";
import {
  loadAllUpcomingOfficialEvents,
  loadUpcomingOfficialEvents,
  officialRacePath,
  type OfficialEvent,
} from "@/lib/official-events";
import { formatEventDate, NO_OG_METADATA } from "@/lib/seo";
import { AvatarUpload } from "@/components/product/AvatarUpload";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { ProductShell } from "@/components/product/ProductShell";
import { RaceCard } from "@/components/product/RaceCard";
import {
  MeZoneBoard,
  type OwnerZone,
} from "@/components/product/ZoneStatusControls";
import {
  isPublishedEventStatus,
  type BidStatus,
  type EventStatus,
  type ZoneStatus,
} from "@/lib/types";
import { isZoneName, ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { CancelEventButton } from "./CancelEventButton";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await getSessionUser();
  return {
    title: profile?.role === "brand" ? "Bids" : "Me",
    ...NO_OG_METADATA,
  };
}

export const dynamic = "force-dynamic";

const BRAND_BID_STATUSES: BidStatus[] = ["held", "won", "refunded"];

type AthleteEvent = {
  id: string;
  name: string;
  slug: string;
  status: EventStatus;
  date: string;
  city: string | null;
  sport: string | null;
  zones: OwnerZone[];
  proofStatus: ProofStatus | null;
};

const ATHLETE_EVENT_STATUSES: EventStatus[] = [
  "draft",
  "live",
  "closed",
  "done",
];

type BrandBid = {
  id: string;
  amount_cents: number;
  status: BidStatus;
  zoneLabel: string;
  eventName: string;
  eventSlug: string | null;
  eventDate: string | null;
};

function isAthleteEventStatus(value: string): value is EventStatus {
  return ATHLETE_EVENT_STATUSES.includes(value as EventStatus);
}

function isProofStatus(value: string | null | undefined): value is ProofStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function bidStatusLabel(status: BidStatus) {
  if (status === "held") {
    return "Held";
  }
  if (status === "won") {
    return "Won";
  }
  if (status === "refunded") {
    return "Outbid";
  }
  return status;
}

async function loadAthleteEvents(
  supabase: NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>,
  userId: string,
): Promise<AthleteEvent[]> {
  await demoteLiveWithoutReadyGlb(supabase, userId);
  const { data: rows } = await supabase
    .from("events")
    .select("id, name, slug, status, date, city, sport")
    .eq("athlete_id", userId)
    .in("status", ATHLETE_EVENT_STATUSES)
    .order("date", { ascending: false });

  const list = (rows ?? []).filter((row) => isAthleteEventStatus(row.status));
  for (const row of list) {
    if (row.status === "live" && isAuctionClosed(row.date)) {
      await closeEventAuction(row.id);
      const { data: settled } = await supabase
        .from("events")
        .select("status")
        .eq("id", row.id)
        .maybeSingle();
      if (settled && isAthleteEventStatus(settled.status)) {
        row.status = settled.status;
      }
    }
  }

  const eventIds = list.map((row) => row.id);
  const proofByEvent = await loadProofStatus(supabase, eventIds);
  const events: AthleteEvent[] = [];
  for (const row of list) {
    events.push({
      ...row,
      zones: await loadOwnerZones(supabase, row.id),
      proofStatus: proofByEvent.get(row.id) ?? null,
    });
  }
  return pickAthleteEvents(events);
}

function pickAthleteEvents(events: AthleteEvent[]) {
  const active = events.find(
    (event) => event.status === "draft" || event.status === "live",
  );
  const closed = events.filter(
    (event) => event.status === "closed" || event.status === "done",
  );
  const needsProof = closed.find((event) => {
    const line = athleteEventLine(event);
    return line.phase !== "approved";
  });
  const picked: AthleteEvent[] = [];
  if (active) {
    picked.push(active);
  }
  if (needsProof && needsProof.id !== active?.id) {
    picked.push(needsProof);
  }
  if (picked.length === 0 && closed[0]) {
    picked.push(closed[0]);
  }
  return picked;
}

function athleteEventLine(event: AthleteEvent) {
  const hasBids = event.zones.some((zone) => zone.occupied);
  const hasWonZone = event.zones.some(
    (zone) =>
      zone.leadStatus === "won" ||
      (isAuctionClosed(event.date) && zone.leadStatus === "held"),
  );
  return athleteEventStatus({
    eventId: event.id,
    slug: event.slug,
    status: event.status,
    eventDate: event.date,
    hasBids,
    hasWonZone,
    proofStatus: event.proofStatus,
  });
}

async function loadProofStatus(
  supabase: NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>,
  eventIds: string[],
) {
  const map = new Map<string, ProofStatus>();
  if (eventIds.length === 0) {
    return map;
  }
  const { data } = await supabase
    .from("proofs")
    .select("event_id, status, created_at")
    .in("event_id", eventIds)
    .order("created_at", { ascending: false });
  for (const row of data ?? []) {
    if (map.has(row.event_id) || !isProofStatus(row.status)) {
      continue;
    }
    map.set(row.event_id, row.status);
  }
  return map;
}

async function loadOwnerZones(
  supabase: NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>,
  eventId: string,
): Promise<OwnerZone[]> {
  const { data: zoneRows } = await supabase
    .from("zones")
    .select("id, name, status")
    .eq("event_id", eventId);
  const zoneIds = (zoneRows ?? []).map((zone) => zone.id);
  const { data: bids } = zoneIds.length
    ? await supabase
        .from("bids")
        .select("zone_id, amount_cents, status, brand_id")
        .in("zone_id", zoneIds)
        .in("status", ["held", "won"])
    : {
        data: [] as Array<{
          zone_id: string;
          amount_cents: number;
          status: string;
          brand_id: string;
        }>,
      };

  const leadByZone = new Map<
    string,
    { amount_cents: number; status: "held" | "won"; brand_id: string }
  >();
  for (const bid of bids ?? []) {
    if (bid.status !== "held" && bid.status !== "won") {
      continue;
    }
    const current = leadByZone.get(bid.zone_id);
    if (!current || bid.amount_cents >= current.amount_cents) {
      leadByZone.set(bid.zone_id, {
        amount_cents: bid.amount_cents,
        status: bid.status,
        brand_id: bid.brand_id,
      });
    }
  }

  const brandIds = [
    ...new Set([...leadByZone.values()].map((lead) => lead.brand_id)),
  ];
  const { data: brands } = brandIds.length
    ? await supabase.from("profiles").select("id, logo_url").in("id", brandIds)
    : { data: [] as Array<{ id: string; logo_url: string | null }> };
  const logoByBrand = new Map(
    (brands ?? []).map((brand) => [brand.id, brand.logo_url]),
  );

  const rowByName = new Map((zoneRows ?? []).map((zone) => [zone.name, zone]));
  return ZONE_NAMES.flatMap((name) => {
    const row = rowByName.get(name);
    if (!row) {
      return [];
    }
    const lead = leadByZone.get(row.id);
    return [
      {
        id: row.id,
        name: name as ZoneName,
        status: (row.status as ZoneStatus) === "closed" ? "closed" : "open",
        occupied: Boolean(lead),
        currentCents: lead?.amount_cents ?? null,
        leadStatus: lead?.status ?? null,
        logoUrl: lead ? logoByBrand.get(lead.brand_id) ?? null : null,
      },
    ];
  });
}

async function loadBrandBids(
  supabase: NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>,
  userId: string,
): Promise<BrandBid[]> {
  const { data: bidRows } = await supabase
    .from("bids")
    .select("id, amount_cents, status, zone_id")
    .eq("brand_id", userId)
    .in("status", BRAND_BID_STATUSES)
    .order("created_at", { ascending: false });

  if (!bidRows?.length) {
    return [];
  }

  const zoneIds = [...new Set(bidRows.map((row) => row.zone_id))];
  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, event_id")
    .in("id", zoneIds);
  const zoneMap = new Map((zones ?? []).map((row) => [row.id, row]));

  const eventIds = [
    ...new Set((zones ?? []).map((row) => row.event_id).filter(Boolean)),
  ];
  const { data: events } =
    eventIds.length > 0
      ? await supabase
          .from("events")
          .select("id, name, slug, date, status")
          .in("id", eventIds)
      : { data: [] as Array<{
          id: string;
          name: string;
          slug: string;
          date: string;
          status: EventStatus;
        }> };
  const eventMap = new Map((events ?? []).map((row) => [row.id, row]));

  return bidRows.map((bid) => {
    const zone = zoneMap.get(bid.zone_id);
    const event = zone ? eventMap.get(zone.event_id) : undefined;
    const zoneName = zone?.name ?? "";
    return {
      id: bid.id,
      amount_cents: bid.amount_cents,
      status: bid.status as BidStatus,
      zoneLabel: isZoneName(zoneName) ? ZONE_LABEL[zoneName] : zoneName || "Zone",
      eventName: event?.name ?? "Event",
      // Draft and cancelled event pages 404. Only link when the listing is public.
      eventSlug:
        event && isPublishedEventStatus(event.status) ? event.slug : null,
      eventDate: event?.date ?? null,
    };
  });
}

async function suggestedRacesForSport(
  supabase: NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>,
  sport: string | null,
) {
  const inSport = await loadUpcomingOfficialEvents(supabase, sport);
  return inSport.slice(0, 3);
}

export default async function MePage() {
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/me");
  if (gate) {
    redirect(gate);
  }
  if (!user || !profile?.role) {
    redirect("/onboarding");
  }

  const isAthlete = profile.role === "athlete";
  let athleteEvents: AthleteEvent[] = [];
  let brandBids: BrandBid[] = [];
  let suggestedRaces: OfficialEvent[] = [];
  let liveCards: LiveSlotCardRow[] = [];

  if (supabase && isAthlete) {
    athleteEvents = await loadAthleteEvents(supabase, user.id);
    if (athleteEvents.length === 0) {
      suggestedRaces = await suggestedRacesForSport(supabase, profile.sport);
    }
  } else if (supabase) {
    brandBids = await loadBrandBids(supabase, user.id);
    if (brandBids.length === 0) {
      const [live, races] = await Promise.all([
        loadLiveSlotCards(supabase),
        loadAllUpcomingOfficialEvents(supabase),
      ]);
      liveCards = live;
      suggestedRaces = races.slice(0, 3);
    }
  }

  return (
    <ProductShell email={user.email} role={profile.role}>
      {isAthlete ? (
        <AthleteMe
          events={athleteEvents}
          races={suggestedRaces}
          userId={user.id}
          name={profile.name ?? ""}
          photoUrl={profile.photo_url ?? null}
        />
      ) : (
        <BrandMe bids={brandBids} live={liveCards} races={suggestedRaces} />
      )}
    </ProductShell>
  );
}

function AthleteMe({
  events,
  races,
  userId,
  name,
  photoUrl,
}: {
  events: AthleteEvent[];
  races: OfficialEvent[];
  userId: string;
  name: string;
  photoUrl: string | null;
}) {
  const canList = !events.some(
    (event) => event.status === "draft" || event.status === "live",
  );
  return (
    <div className="page-stack">
      <div className="page-head-split">
        <div className="me-identity">
          <AvatarUpload userId={userId} name={name} initialUrl={photoUrl} />
          <h1 className="slot-board-kicker">Your bib</h1>
        </div>
        {events.length > 0 && canList ? (
          <Link href="/new" className="cta-press page-head-btn">
            <span className="cta-press-plate" aria-hidden="true" />
            <span className="cta-press-face">Participate</span>
          </Link>
        ) : null}
      </div>

      {events.length > 0 ? (
        events.map((event) => (
          <AthleteEventCard key={event.id} event={event} />
        ))
      ) : (
        <>
          <p className="text-[14px] text-muted">No race yet.</p>
          <Link href="/new" className="cta-press">
            <span className="cta-press-plate" aria-hidden="true" />
            <span className="cta-press-face">Participate</span>
          </Link>
          {races.length > 0 ? (
            <SuggestedRaces races={races} />
          ) : null}
        </>
      )}
    </div>
  );
}

function SuggestedRaces({ races }: { races: OfficialEvent[] }) {
  return (
    <>
      <h2 className="slot-board-kicker mt-8">Upcoming events</h2>
      <ul className="event-card-grid">
        {races.map((race, index) => (
          <li key={race.starts_on}>
            <RaceCard
              race={race}
              href={officialRacePath(race.starts_on)}
              eager={index < 2}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function AthleteEventCard({ event }: { event: AthleteEvent }) {
  const status = athleteEventLine(event);
  const canCancel =
    (event.status === "draft" || event.status === "live") &&
    !event.zones.some((zone) => zone.occupied);

  return (
    <>
      <div className="bib max-w-lg p-5">
        <h2 className="bib-title">{event.name}</h2>
        <p className="bib-meta">{formatEventDate(event.date)}</p>
        <p className="bib-place">
          {event.city ?? "-"} · {event.sport ?? "-"}
        </p>
        <p className="page-lead">{status.line}</p>
        {status.action || canCancel ? (
          <div className="me-actions">
            {status.action ? (
              <Link href={status.action.href} className="cta-press">
                <span className="cta-press-plate" aria-hidden="true" />
                <span className="cta-press-face">{status.action.label}</span>
              </Link>
            ) : null}
            {canCancel ? <CancelEventButton eventId={event.id} /> : null}
          </div>
        ) : null}
      </div>
      {event.zones.length > 0 ? (
        <MeZoneBoard eventDate={event.date} zones={event.zones} />
      ) : null}
    </>
  );
}

function BrandMe({
  bids,
  live,
  races,
}: {
  bids: BrandBid[];
  live: LiveSlotCardRow[];
  races: OfficialEvent[];
}) {
  return (
    <div className="page-stack">
      <h1 className="slot-board-kicker">Your bids</h1>

      {bids.length === 0 ? (
        <>
          <p className="text-[14px] text-muted">No bids yet.</p>
          <Link href="/events" className="cta-press">
            <span className="cta-press-plate" aria-hidden="true" />
            <span className="cta-press-face">Browse live athletes</span>
          </Link>
          {live.length > 0 ? (
            <ul className="live-body-list">
              {live.map((card, index) => (
                <li key={card.id}>
                  <LiveSlotCard card={card} eager={index < 2} />
                </li>
              ))}
            </ul>
          ) : null}
          {races.length > 0 ? <SuggestedRaces races={races} /> : null}
        </>
      ) : (
        <ul className="slot-board">
          {bids.map((bid) => {
            const body = (
              <>
                <p className="slot-ticket-zone">{bid.zoneLabel}</p>
                <p className="slot-ticket-price">
                  {centsToUsd(bid.amount_cents)}
                </p>
                <p className="slot-ticket-event">{bid.eventName}</p>
                <p className="slot-ticket-meta">
                  {bid.eventDate ? formatEventDate(bid.eventDate) : "—"}
                </p>
                <p className={`slot-ticket-open is-${bid.status}`}>
                  {bidStatusLabel(bid.status)}
                </p>
              </>
            );

            return (
              <li key={bid.id}>
                {bid.eventSlug ? (
                  <Link href={`/e/${bid.eventSlug}`} className="slot-ticket">
                    {body}
                  </Link>
                ) : (
                  <div className="slot-ticket">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
