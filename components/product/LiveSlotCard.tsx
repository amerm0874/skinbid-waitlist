"use client";

import { useState } from "react";
import Link from "next/link";
import type { LiveSlotCard as LiveSlotCardRow } from "@/lib/live-listings";

function nameInitial(name: string) {
  const letter = name.trim().slice(0, 1);
  return letter ? letter.toUpperCase() : "A";
}

function LiveBodyFace({
  photoUrl,
  name,
  eager,
}: {
  photoUrl: string | null;
  name: string;
  eager: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoUrl?.trim() || null;

  if (photo && !photoFailed) {
    return (
      <img
        src={photo}
        alt=""
        className="live-body-photo"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

  return (
    <span className="live-body-initial" aria-hidden="true">
      {nameInitial(name)}
    </span>
  );
}

export function LiveSlotCard({
  card,
  eager = false,
}: {
  card: LiveSlotCardRow;
  eager?: boolean;
}) {
  return (
    <Link href={`/e/${card.slug}`} className="live-body-card">
      <div className="live-body-face">
        <LiveBodyFace
          photoUrl={card.photoUrl}
          name={card.athleteName}
          eager={eager}
        />
      </div>
      <div className="live-body-copy">
        <p className="live-body-name">{card.athleteName}</p>
        <p className="live-body-meta">{card.sport?.trim() || "—"}</p>
        <p className="live-body-meta">{card.raceName}</p>
      </div>
      <p className="live-body-price live-body-price-gated">Opens soon</p>
    </Link>
  );
}
