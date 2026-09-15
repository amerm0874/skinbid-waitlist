import { AuctionClock } from "@/components/product/AuctionClock";
import { EventLink } from "@/components/product/EventLink";
import {
  formatRaceDay,
  raceClockDate,
} from "@/lib/official-events";

export function RaceListRow({
  href,
  name,
  city,
  date,
  athleteCount,
}: {
  href: string;
  name: string;
  city: string | null;
  date: string;
  athleteCount: number;
}) {
  return (
    <EventLink href={href} className="race-meet-row">
      <div className="race-date-tile" aria-hidden="true">
        <span>{new Date(date).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>
        <strong>{new Date(date).getUTCDate()}</strong>
      </div>
      <div className="race-meet-row-copy">
        <p className="race-meet-row-name">{name}</p>
        {city ? <p className="race-meet-row-city">{city}</p> : null}
        <p className="race-meet-row-date">{formatRaceDay(date)}</p>
        <p className="race-meet-row-inventory">
          {athleteCount} {athleteCount === 1 ? "athlete" : "athletes"} to sponsor
        </p>
      </div>
      <AuctionClock eventDate={raceClockDate(date)} />
      <span className="race-open-label">Explore race <span aria-hidden="true">↗</span></span>
    </EventLink>
  );
}

export function EventMeet({
  name,
  sport,
  city,
  date,
  showAuction = true,
}: {
  name: string;
  sport: string | null;
  city: string | null;
  date: string;
  showAuction?: boolean;
}) {
  const bits = [sport, city, formatRaceDay(date)].filter(Boolean);
  return (
    <header className="event-meet">
      <div className="event-meet-copy">
        <h1 className="event-meet-name">{name}</h1>
        {bits.length > 0 ? (
          <p className="event-meet-meta">{bits.join(" · ")}</p>
        ) : null}
      </div>
      {showAuction ? <AuctionClock eventDate={raceClockDate(date)} /> : null}
    </header>
  );
}
