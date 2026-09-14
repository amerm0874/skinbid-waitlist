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
}: {
  href: string;
  name: string;
  city: string | null;
  date: string;
}) {
  return (
    <EventLink href={href} className="race-meet-row">
      <div className="race-meet-row-copy">
        <p className="race-meet-row-name">{name}</p>
        {city ? <p className="race-meet-row-city">{city}</p> : null}
        <p className="race-meet-row-date">{formatRaceDay(date)}</p>
      </div>
      <AuctionClock eventDate={raceClockDate(date)} />
    </EventLink>
  );
}

export function EventMeet({
  name,
  sport,
  city,
  date,
}: {
  name: string;
  sport: string | null;
  city: string | null;
  date: string;
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
      <AuctionClock eventDate={raceClockDate(date)} />
    </header>
  );
}
