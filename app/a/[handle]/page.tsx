import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvertiseBrandButton } from "@/components/product/AdvertiseBrandButton";
import { AuctionClock } from "@/components/product/AuctionClock";
import { EmptyState } from "@/components/product/EmptyState";
import { ProductShell } from "@/components/product/ProductShell";
import { ProfileClip } from "@/components/product/ProfileClip";
import { SocialNetworkIcon } from "@/components/product/SocialNetworkIcon";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSessionUser } from "@/lib/auth";
import { loadAthleteProfileClipUrl } from "@/lib/capture-state";
import { athleteSportLabel } from "@/lib/config";
import { formatRaceDay, raceClockDate } from "@/lib/official-events";
import { loadAthleteByHandle } from "@/lib/public-listings";
import {
  athletePageDescription,
  athletePageJsonLd,
  athletePageTitle,
  NO_OG_METADATA,
  shareMetadata,
} from "@/lib/seo";
import { publicShareSocials } from "@/lib/socials";

type PageProps = {
  params: Promise<{ handle: string }>;
};

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "A";
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const athlete = await loadAthleteByHandle(handle);
  if (!athlete) {
    return {
      ...NO_OG_METADATA,
      title: { absolute: "Not found | SkinBid" },
    };
  }
  const eventName = athlete.liveEvent?.name ?? athlete.race?.name ?? null;
  const title = athletePageTitle(athlete.name, eventName);
  const description = athletePageDescription({
    name: athlete.name,
    eventName,
    dateIso: athlete.liveEvent?.date ?? athlete.race?.starts_on ?? null,
  });
  return shareMetadata(title, description, `/a/${athlete.handle}`);
}

export default async function AthletePage({ params }: PageProps) {
  const { handle } = await params;
  const athlete = await loadAthleteByHandle(handle);
  if (!athlete) {
    notFound();
  }

  const { user, profile } = await getSessionUser();
  const socials = publicShareSocials(athlete.socials, athlete.social);
  const sport =
    athleteSportLabel(athlete.sport, athlete.sportDetail) ??
    athlete.sport?.trim() ??
    null;
  const live = athlete.liveEvent;
  const nextRace = live ?? (athlete.race
    ? {
        name: athlete.race.name,
        date: athlete.race.starts_on,
        city: athlete.race.city,
        slug: null as string | null,
      }
    : null);
  const profileClipUrl = await loadAthleteProfileClipUrl(athlete.id);
  const bits = [athlete.age, sport, live?.city ?? athlete.race?.city, athlete.country]
    .filter((value) => value != null && String(value).trim())
    .map(String);

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <JsonLd
        data={athletePageJsonLd({
          name: athlete.name,
          handle: athlete.handle,
          sameAs: socials[0]?.href ?? null,
          country: athlete.country,
          liveEvent: live
            ? {
                name: live.name,
                dateIso: live.date,
                slug: live.slug,
                city: live.city,
                openCount: live.openCount,
              }
            : null,
        })}
      />

      <div className="athlete-page">
        {profileClipUrl ? (
          <div className="athlete-face has-photo">
            <ProfileClip src={profileClipUrl} />
          </div>
        ) : athlete.photoUrl ? (
          <div className="athlete-face has-photo">
            <img src={athlete.photoUrl} alt="" className="athlete-face-photo" />
          </div>
        ) : (
          <div className="athlete-face">
            <span className="athlete-face-initial" aria-hidden="true">
              {nameInitial(athlete.name)}
            </span>
          </div>
        )}

        <header className="athlete-meet">
          <h1 className="athlete-meet-name">{athlete.name}</h1>
          {bits.length > 0 ? (
            <p className="athlete-meet-meta">{bits.join(" · ")}</p>
          ) : null}
        </header>

        {nextRace ? (
          <section className="athlete-next">
            <p className="athlete-next-name">{nextRace.name}</p>
            <p className="athlete-next-meta">
              {[nextRace.city, formatRaceDay(nextRace.date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <AuctionClock eventDate={raceClockDate(nextRace.date)} />
          </section>
        ) : null}

        {live && live.openZones.length > 0 ? (
          <ul className="athlete-zones">
            {live.openZones.map((zone) => (
              <li key={zone}>{zone}</li>
            ))}
          </ul>
        ) : null}

        {live ? <AdvertiseBrandButton slug={live.slug} full /> : null}

        {socials.length > 0 ? (
          <ul className="athlete-socials">
            {socials.map((row) => (
              <li key={`${row.network}-${row.href}`}>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="athlete-social"
                  aria-label={row.network}
                >
                  <SocialNetworkIcon network={row.network} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {live ? null : <EmptyState line="No live event." />}
      </div>
    </ProductShell>
  );
}
