import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/product/EmptyState";
import { EventMeet } from "@/components/product/RaceMeet";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { ProductShell } from "@/components/product/ProductShell";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import {
  findLiveRaceHub,
  listingsForRace,
  loadLiveSlotCards,
  type LiveSlotCard as LiveSlotCardRow,
} from "@/lib/live-listings";
import {
  formatOfficialDate,
  listRacePath,
  loadOfficialEventByStartsOn,
  officialEventByStartsOn,
  OFFICIAL_EVENTS,
} from "@/lib/official-events";
import { withOfficialPageFacts } from "@/lib/official-og";
import {
  NO_OG_METADATA,
  racePageDescription,
  racePageTitle,
  shareMetadata,
} from "@/lib/seo";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return OFFICIAL_EVENTS.map((row) => ({ id: row.starts_on }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const race = officialEventByStartsOn(id);
  if (race) {
    const dateLabel = formatOfficialDate(race.starts_on);
    return shareMetadata(
      racePageTitle(race.name, dateLabel),
      racePageDescription({
        name: race.name,
        city: race.city,
        country: race.country,
        sport: race.sport,
      }),
      `/races/${race.starts_on}`,
    );
  }
  return {
    ...NO_OG_METADATA,
    title: { absolute: "Race | SkinBid" },
  };
}

export default async function RacePage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user, profile } = await getSessionUser();
  const live = await loadLiveSlotCards(supabase);
  const official = await loadOfficialEventByStartsOn(supabase, id);
  const hub = official
    ? null
    : findLiveRaceHub(live, id);

  if (!official && !hub) {
    notFound();
  }

  const gate = sessionGateRedirect(user, profile, `/races/${id}`);
  if (gate) {
    redirect(gate);
  }

  const isAthlete = profile?.role === "athlete";
  let name: string;
  let sport: string | null;
  let city: string | null;
  let date: string;
  let participating: LiveSlotCardRow[];
  let listHref: string | null = null;

  if (official) {
    const [withFacts] = await withOfficialPageFacts([official]);
    const race = withFacts ?? official;
    name = race.name;
    sport = race.combat_subtype
      ? `${race.sport} · ${race.combat_subtype}`
      : race.sport;
    city = race.city;
    date = race.starts_on;
    participating = listingsForRace(live, race);
    listHref = isAthlete ? listRacePath(race.starts_on) : null;
  } else if (hub) {
    name = hub.name;
    sport = hub.sport;
    city = hub.city;
    date = hub.date;
    participating = hub.listings;
    listHref = isAthlete ? "/new" : null;
  } else {
    notFound();
  }

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <nav className="studio-breadcrumb" aria-label="Breadcrumb"><Link href="/events">Events</Link><span aria-hidden="true">/</span><span>{name}</span></nav>
        <EventMeet name={name} sport={sport} city={city} date={date} showAuction={participating.length > 0} />
        <div className="collection-heading"><h2>Choose your athlete</h2><span>{participating.length} open for sponsorship</span></div>

        {participating.length > 0 ? (
          <ul className="live-body-list">
            {participating.map((card, index) => (
              <li key={card.id}>
                <LiveSlotCard card={card} eager={index < 2} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            line="No athletes on this race yet."
            toEvents={isAthlete}
            href={listHref ?? "/events"}
            linkLabel={isAthlete ? "List your race" : "Explore other races"}
          />
        )}
      </div>
    </ProductShell>
  );
}
