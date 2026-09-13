import Link from "next/link";
import {
  formatOfficialDate,
  type OfficialEvent,
} from "@/lib/official-events";
import { RacePoster } from "@/components/product/RacePoster";

export function RaceCard({
  race,
  href,
  eager = false,
}: {
  race: Pick<OfficialEvent, "starts_on" | "name" | "city" | "og_image_url"> & {
    sport: string;
  };
  href: string;
  eager?: boolean;
}) {
  return (
    <Link href={href} className="event-card">
      <RacePoster
        sport={race.sport}
        startsOn={race.starts_on}
        photoUrl={race.og_image_url}
        eager={eager}
        variant="tile"
      />
      <div className="event-card-copy">
        <p className="event-card-date">{formatOfficialDate(race.starts_on)}</p>
        <p className="event-card-name">{race.name}</p>
        <p className="event-card-meta">
          {race.city} · {race.sport}
        </p>
      </div>
    </Link>
  );
}
