"use client";

import { useEffect, useRef, useState } from "react";
import { EventLink } from "@/components/product/EventLink";
import { athleteProfilePath } from "@/lib/handle";
import { formatRaceDay } from "@/lib/official-events";
import type { LiveSlotCard as LiveSlotCardRow } from "@/lib/live-listings";

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "A";
}

function AthleteStill({
  photoUrl,
  clipUrl,
  name,
  eager,
}: {
  photoUrl: string | null;
  clipUrl: string | null;
  name: string;
  eager: boolean;
}) {
  const [photoReady, setPhotoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const photo = photoUrl?.trim() || null;
  const clip = clipUrl?.trim() || null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || photo) {
      return;
    }
    const freeze = () => {
      try {
        video.currentTime = 0.12;
        video.pause();
      } catch {
        video.pause();
      }
    };
    video.addEventListener("loadeddata", freeze);
    return () => video.removeEventListener("loadeddata", freeze);
  }, [clip, photo]);

  return (
    <>
      <span className="live-body-fallback" aria-hidden="true">
        {nameInitial(name)}
      </span>
      {photo ? (
        <img
          src={photo}
          alt=""
          className="live-body-photo"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          hidden={!photoReady}
          onLoad={() => setPhotoReady(true)}
          onError={(event) => {
            event.currentTarget.style.display = "none";
            setPhotoReady(false);
          }}
        />
      ) : clip ? (
        <video
          ref={videoRef}
          className="live-body-photo"
          src={clip}
          muted
          playsInline
          preload={eager ? "auto" : "metadata"}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}

export function LiveSlotCard({
  card,
  eager = false,
}: {
  card: LiveSlotCardRow;
  eager?: boolean;
}) {
  const eventLine = card.raceName?.trim() || card.sport?.trim() || null;
  const href = athleteProfilePath(card.handle) ?? `/e/${card.slug}`;

  return (
    <EventLink href={href} className="live-body-card">
      <div className="live-body-face">
        <AthleteStill
          photoUrl={card.photoUrl}
          clipUrl={card.clipUrl}
          name={card.athleteName}
          eager={eager}
        />
        {card.sport ? <span className="athlete-card-sport">{card.sport}</span> : null}
      </div>
      <div className="live-body-copy">
        <div className="live-body-ident">
          <p className="live-body-name">
            {card.athleteName}
          </p>
          {eventLine ? <p className="live-body-meta">{eventLine}</p> : null}
          <p className="live-body-meta">{[card.city, formatRaceDay(card.date)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="athlete-card-footer"><span>View athlete</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 5l7 7-7 7" /></svg></div>
    </EventLink>
  );
}
