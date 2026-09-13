"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  formatOfficialDate,
  sportFallbackPhoto,
  sportPosterKey,
  storedOgImageUrl,
} from "@/lib/official-events";

const CARD_WIDTH = 640;
const CARD_HEIGHT = 480;

export function RacePoster({
  sport,
  startsOn,
  photoUrl,
  eager = false,
  variant = "hero",
}: {
  sport: string;
  startsOn: string;
  photoUrl?: string | null;
  eager?: boolean;
  variant?: "hero" | "tile";
}) {
  const official = storedOgImageUrl(photoUrl);
  const fallback = sportFallbackPhoto(sport);
  const [officialFailed, setOfficialFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const day = startsOn.slice(8, 10);
  const month = formatOfficialDate(startsOn).split(" ")[1] ?? "";

  useEffect(() => {
    setOfficialFailed(false);
  }, [official]);

  const photo = (
    <div
      className={
        official ? "race-poster" : `race-poster is-${sportPosterKey(sport)}`
      }
    >
      {official && !officialFailed ? (
        <img
          src={official}
          alt=""
          className="race-poster-photo"
          referrerPolicy="no-referrer"
          onError={() => setOfficialFailed(true)}
        />
      ) : !official && !fallbackFailed ? (
        <Image
          src={fallback}
          alt=""
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          className="race-poster-photo"
          sizes={
            variant === "tile"
              ? "(min-width: 720px) 720px, 100vw"
              : eager
                ? "32rem"
                : "(min-width: 640px) 50vw, 100vw"
          }
          loading={eager ? "eager" : "lazy"}
          priority={eager}
          onError={() => setFallbackFailed(true)}
        />
      ) : null}
    </div>
  );

  if (variant === "tile") {
    return <div className="event-card-tile">{photo}</div>;
  }

  return (
    <div className="race-press-block">
      <div className="press-art race-press">
        <span className="press-art-plate" aria-hidden="true" />
        <div className="press-art-face">{photo}</div>
      </div>
      <p className="race-poster-day">{day}</p>
      <p className="race-poster-month">{month}</p>
    </div>
  );
}
