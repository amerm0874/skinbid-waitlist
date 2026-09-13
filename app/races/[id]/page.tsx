import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { listingsForRace, loadLiveSlotCards } from "@/lib/live-listings";
import {
  formatOfficialDate,
  listRacePath,
  loadOfficialEventByStartsOn,
  officialEventByStartsOn,
  OFFICIAL_EVENTS,
  type OfficialEvent,
} from "@/lib/official-events";
import { withOfficialPageFacts } from "@/lib/official-og";
import {
  NO_OG_METADATA,
  racePageDescription,
  racePageTitle,
  shareMetadata,
} from "@/lib/seo";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { RacePoster } from "@/components/product/RacePoster";
import { ProductShell } from "@/components/product/ProductShell";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return OFFICIAL_EVENTS.map((row) => ({ id: row.starts_on }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const race = officialEventByStartsOn(id);
  if (!race) {
    return {
      ...NO_OG_METADATA,
      title: { absolute: "Not found | SkinBid" },
    };
  }
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

export default async function RacePage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user, profile } = await getSessionUser();
  const found = await loadOfficialEventByStartsOn(supabase, id);
  if (!found) {
    notFound();
  }

  const gate = sessionGateRedirect(user, profile, `/races/${found.starts_on}`);
  if (gate) {
    redirect(gate);
  }

  const [races, live] = await Promise.all([
    withOfficialPageFacts([found]),
    loadLiveSlotCards(supabase),
  ]);
  const race = races[0] ?? found;
  const isAthlete = profile?.role === "athlete";
  const participating = listingsForRace(live, race);

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <div className="race-file">
          <RacePoster
            sport={race.sport}
            startsOn={race.starts_on}
            photoUrl={race.og_image_url}
            eager
          />
          <RaceFacts race={race} />
          {isAthlete ? (
            <Link href={listRacePath(race.starts_on)} className="cta-press">
              <span className="cta-press-plate" aria-hidden="true" />
              <span className="cta-press-face">Participate</span>
            </Link>
          ) : null}
        </div>

        <section>
          <h2 className="slot-board-kicker">Participating</h2>
          {participating.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">No one is participating yet.</p>
          ) : (
            <ul className="live-body-list mt-3">
              {participating.map((card) => (
                <li key={card.id}>
                  <LiveSlotCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ProductShell>
  );
}

function RaceFacts({ race }: { race: OfficialEvent }) {
  const sport = race.combat_subtype
    ? `${race.sport} · ${race.combat_subtype}`
    : race.sport;
  const rows = [
    { label: "Name", value: race.name, title: true },
    { label: "Date", value: formatOfficialDate(race.starts_on) },
    { label: "City", value: race.city },
    { label: "Country", value: race.country },
    { label: "Venue", value: race.venue },
    { label: "Sport", value: sport },
    {
      label: "Official",
      value: officialLinkLabel(race.official_url),
      href: race.official_url,
    },
  ].filter((row) => Boolean(row.value?.trim()));

  return (
    <dl className="race-facts">
      {rows.map((row) => (
        <div key={row.label} className="race-fact">
          <dt>{row.label}</dt>
          <dd>
            {row.title ? (
              <h1 className="race-fact-name display">{row.value}</h1>
            ) : null}
            {!row.title && row.href ? (
              <a href={row.href} target="_blank" rel="noreferrer">
                {row.value}
              </a>
            ) : null}
            {!row.title && !row.href ? row.value : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function officialLinkLabel(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "Official race site";
  }
}
