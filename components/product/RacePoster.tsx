"use client";

import { useEffect, useState } from "react";
import { formatOfficialDate, storedOgImageUrl } from "@/lib/official-events";

export function RacePoster({
  startsOn,
  photoUrl,
  name,
  eager = false,
  variant = "hero",
}: {
  sport?: string;
  startsOn: string;
  photoUrl?: string | null;
  name: string;
  eager?: boolean;
  variant?: "hero" | "tile";
}) {
  const official = storedOgImageUrl(photoUrl);
  const [photoReady, setPhotoReady] = useState(false);
  const day = startsOn.slice(8, 10);
  const month = formatOfficialDate(startsOn).split(" ")[1] ?? "";

  useEffect(() => {
    setPhotoReady(false);
  }, [official]);

  const photo = (
    <div className="race-poster">
      <p className="race-poster-fallback-name">{name}</p>
      {official ? (
        <img
          src={official}
          alt=""
          className="race-poster-photo"
          referrerPolicy="no-referrer"
          loading={eager ? "eager" : "lazy"}
          hidden={!photoReady}
          onLoad={() => setPhotoReady(true)}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            setPhotoReady(false);
          }}
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
