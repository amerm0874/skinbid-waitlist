import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { athleteSportLabel } from "@/lib/config";
import { loadAthleteByHandle } from "@/lib/public-listings";
import {
  athletePageDescription,
  athletePageJsonLd,
  athletePageTitle,
  NO_OG_METADATA,
  shareMetadata,
} from "@/lib/seo";
import { publicSocialLinks } from "@/lib/socials";
import { AthleteBody } from "@/components/product/AthleteBody";
import { EmptyState } from "@/components/product/EmptyState";
import { ProductShell } from "@/components/product/ProductShell";
import { RaceCard } from "@/components/product/RaceCard";
import { SocialNetworkIcon } from "@/components/product/SocialNetworkIcon";
import { JsonLd } from "@/components/seo/JsonLd";

type PageProps = {
  params: Promise<{ handle: string }>;
};

export const dynamic = "force-dynamic";

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "A";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const athlete = await loadAthleteByHandle(handle);
  if (!athlete) {
    return {
      ...NO_OG_METADATA,
      title: { absolute: "Not found | SkinBid" },
    };
  }
  const title = athletePageTitle(athlete.name);
  const description = athletePageDescription({
    name: athlete.name,
    eventName: athlete.liveEvent?.name ?? athlete.race?.name ?? null,
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
  const socials = publicSocialLinks(athlete.socials, athlete.social);
  const sport =
    athleteSportLabel(athlete.sport, athlete.sportDetail) ??
    athlete.sport?.trim() ??
    "—";
  const live = athlete.liveEvent;
  const hasCage = Boolean(athlete.glbUrl);

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
        {hasCage ? <AthleteBody glbUrl={athlete.glbUrl!} /> : null}

        <div className={hasCage ? "athlete-bib athlete-bib-compact" : "athlete-bib"}>
          {athlete.photoUrl ? (
            <img
              key={athlete.photoUrl}
              src={athlete.photoUrl}
              alt=""
              className="athlete-photo"
            />
          ) : (
            <span className="athlete-photo athlete-photo-initial" aria-hidden="true">
              {nameInitial(athlete.name)}
            </span>
          )}
          <div className="athlete-bib-copy">
            <h1 className="athlete-bib-name">{athlete.name}</h1>
            <p className="athlete-bib-meta">
              {athlete.country?.trim() || "—"} · {sport}
            </p>
            {socials.length > 0 ? (
              <ul className="athlete-socials">
                {socials.map((row) => (
                  <li key={`${row.network}-${row.href}`}>
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="athlete-social"
                    >
                      <SocialNetworkIcon network={row.network} />
                      <span>{row.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {athlete.race ? (
          <ul className="event-card-grid athlete-race">
            <li>
              <RaceCard race={athlete.race} href={athlete.race.href} eager />
            </li>
          </ul>
        ) : (
          <EmptyState line="No live race." />
        )}
      </div>
    </ProductShell>
  );
}
