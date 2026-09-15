import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { groupLiveRaces, loadLiveSlotCards } from "@/lib/live-listings";
import {
  EVENTS_INDEX_DESCRIPTION,
  EVENTS_INDEX_TITLE,
  shareMetadata,
} from "@/lib/seo";
import { EmptyState } from "@/components/product/EmptyState";
import { ProductShell } from "@/components/product/ProductShell";
import { RaceListRow } from "@/components/product/RaceMeet";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { RaceCard } from "@/components/product/RaceCard";
import { loadAllUpcomingOfficialEvents, officialRacePath } from "@/lib/official-events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = shareMetadata(
  EVENTS_INDEX_TITLE,
  EVENTS_INDEX_DESCRIPTION,
  "/events",
);

export default async function EventsPage() {
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/events");
  if (gate) {
    redirect(gate);
  }

  const [cards, officialEvents] = await Promise.all([
    loadLiveSlotCards(supabase),
    loadAllUpcomingOfficialEvents(supabase),
  ]);
  const races = groupLiveRaces(cards, officialEvents);
  const livePaths = new Set(races.map((race) => race.href));
  const calendar = officialEvents.filter((race) => !livePaths.has(officialRacePath(race.starts_on)));

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <div className="board-intro">
          <h1 className="page-title">Your brand. Race day.</h1>
          <p className="page-lead">
            Find your race. Back an athlete. Put your brand in the action.
          </p>
        </div>
        <div className="discovery-guide" aria-label="How sponsorship works">
          <span><b>1</b> Choose a race & athlete</span>
          <span><b>2</b> Bid on a body placement</span>
          <span><b>3</b> Pay & add your logo</span>
        </div>
        <div className="collection-heading"><h2>Open for sponsorship</h2><span>{races.length} {races.length === 1 ? "race" : "races"}</span></div>
        {races.length > 0 ? (
          <ul className="race-meet-list">
            {races.map((race) => (
              <li key={race.key}>
                <RaceListRow
                  href={race.href}
                  name={race.name}
                  city={race.city}
                  date={race.date}
                  athleteCount={race.listings.length}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            line="No athletes are open for sponsorship yet. You can still explore the race calendar below."
            toEvents={profile?.role === "athlete"}
            href={profile?.role === "athlete" ? "/new" : undefined}
            linkLabel={profile?.role === "athlete" ? "List your race" : undefined}
          />
        )}
        {calendar.length > 0 ? (
          <section className="race-calendar" aria-labelledby="race-calendar-heading">
            <div className="collection-heading"><h2 id="race-calendar-heading">Race calendar</h2><span>{calendar.length} upcoming events</span></div>
            <p className="calendar-note">Explore upcoming races. Athlete listings will appear as they join.</p>
            <ul className="calendar-grid">{calendar.map((race, index) => <li key={race.starts_on}><RaceCard race={race} href={officialRacePath(race.starts_on)} eager={index < 3} /></li>)}</ul>
          </section>
        ) : null}
        {cards.length > 0 ? <section className="discovery-athletes"><div className="collection-heading"><h2>Meet the athletes</h2><a href="/athletes">View all athletes</a></div><ul className="live-body-list">{cards.slice(0, 3).map((card) => <li key={card.id}><LiveSlotCard card={card} /></li>)}</ul></section> : null}
      </div>
    </ProductShell>
  );
}
