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
import Link from "next/link";
import { centsToUsd } from "@/lib/money";
import { loadBodyPhotos } from "@/lib/body-photos";
import { loadIntroductionVideo } from "@/lib/athlete-media";

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
  const [profileClipUrl, bodyPhotos, introductionVideo] = await Promise.all([
    loadAthleteProfileClipUrl(athlete.id),
    athlete.photoUrl ? Promise.resolve(null) : loadBodyPhotos(athlete.id),
    loadIntroductionVideo(athlete.id),
  ]);
  const portraitUrl = athlete.photoUrl ?? bodyPhotos?.front;
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

      <nav className="studio-breadcrumb" aria-label="Breadcrumb"><Link href="/athletes">Athletes</Link><span aria-hidden="true">/</span><span>{athlete.name}</span></nav>
      <div className="athlete-page">
        {profileClipUrl ? (
          <div className="athlete-face has-photo">
            <ProfileClip src={profileClipUrl} />
          </div>
        ) : portraitUrl ? (
          <div className="athlete-face has-photo">
            <img src={portraitUrl} alt={athlete.name} className="athlete-face-photo" />
          </div>
        ) : (
          <div className="athlete-face">
            <span className="athlete-face-initial" aria-hidden="true">
              {nameInitial(athlete.name)}
            </span>
          </div>
        )}

        <div className="athlete-details">
        <header className={live ? "athlete-meet is-listed" : "athlete-meet"}>
          {live ? <p className="availability-note">Open for sponsorship</p> : null}
          <h1 className="athlete-meet-name">{athlete.name}</h1>
          {bits.length > 0 ? (
            <p className="athlete-meet-meta">{bits.join(" · ")}</p>
          ) : null}
        </header>

        {nextRace ? (
          <section className={live ? "athlete-next is-live" : "athlete-next"}>
            <p className="athlete-live-label">Next on the start line</p>
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
          <section className="athlete-inventory">
            <p className="athlete-live-label">Available spots</p>
            <ul className="athlete-zones">
              {live.openZones.map((zone) => (
                <li key={zone}>{zone}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {live ? <div className="athlete-booking"><div><span>Placement from</span><strong>{centsToUsd(live.slotCents)}</strong></div><AdvertiseBrandButton slug={live.slug} full /><p>Choose a placement on {athlete.name.split(" ")[0]}’s photo. Review your bid before checkout.</p></div> : null}

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

        {introductionVideo ? (
          <section className="intro-video-section">
            <h2>Meet {athlete.name.split(" ")[0]}</h2>
            <video
              src={introductionVideo}
              controls
              playsInline
              preload="metadata"
              aria-label={`${athlete.name}'s introduction video`}
            />
            <p>
              Uploaded by the athlete. Compare it with their photos. Skinbid does
              not verify identity.
            </p>
          </section>
        ) : null}

        {live ? null : (
          <EmptyState line="This athlete has no race open for sponsorship." />
        )}
        </div>
      </div>
    </ProductShell>
  );
}
