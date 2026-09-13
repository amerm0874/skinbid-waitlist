"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ATHLETE_SPORTS } from "@/lib/config";
import { listingsForRace, type LiveSlotCard as LiveSlotCardRow } from "@/lib/live-listings";
import {
  officialRacePath,
  type OfficialEvent,
} from "@/lib/official-events";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { RaceCard } from "@/components/product/RaceCard";

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EventsCatalog({
  races,
  live = [],
  asTitle,
  hasLiveBodies = false,
}: {
  races: OfficialEvent[];
  live?: LiveSlotCardRow[];
  asTitle: boolean;
  hasLiveBodies?: boolean;
}) {
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");

  const upcoming = useMemo(() => {
    const today = todayYmd();
    return races
      .filter((row) => row.starts_on >= today)
      .sort((left, right) => left.starts_on.localeCompare(right.starts_on));
  }, [races]);

  const sports = useMemo(() => {
    const present = new Set(upcoming.map((row) => row.sport));
    return ATHLETE_SPORTS.filter((option) => option !== "Other" && present.has(option));
  }, [upcoming]);

  const cities = useMemo(() => {
    const pool = sport
      ? upcoming.filter((row) => row.sport === sport)
      : upcoming;
    return [...new Set(pool.map((row) => row.city))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [upcoming, sport]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return upcoming.filter((row) => {
      if (sport && row.sport !== sport) {
        return false;
      }
      if (city && row.city !== city) {
        return false;
      }
      if (needle && !row.name.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [upcoming, sport, city, query]);

  if (upcoming.length === 0) {
    if (hasLiveBodies) {
      return null;
    }
    return (
      <div className="bib empty-bib">
        <p>
          No live athletes yet.{" "}
          <Link href="/e/demo">See a live event</Link>
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="slot-board-head">
        {asTitle ? (
          <h1 className="slot-board-kicker">Upcoming races</h1>
        ) : (
          <h2 className="slot-board-kicker">Upcoming races</h2>
        )}
      </div>
      <div className="catalog-filters">
        <label>
          <span className="field-label">Sport</span>
          <select
            className="field"
            value={sport}
            onChange={(event) => {
              const next = event.target.value;
              setSport(next);
              const stillValid = upcoming.some(
                (row) =>
                  row.city === city && (!next || row.sport === next),
              );
              if (!stillValid) {
                setCity("");
              }
            }}
          >
            <option value="">All</option>
            {sports.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">City</span>
          <select
            className="field"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          >
            <option value="">All</option>
            {cities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Name</span>
          <input
            className="field"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoComplete="off"
          />
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="bib empty-bib">
          <p>No races match.</p>
        </div>
      ) : (
        <ul className="event-card-grid">
          {visible.map((race, index) => {
            const participating = listingsForRace(live, race);
            return (
              <li key={race.starts_on}>
                <RaceCard
                  race={race}
                  href={officialRacePath(race.starts_on)}
                  eager={index < 2}
                />
                {participating.length > 0 ? (
                  <ul className="live-body-list race-row-participants">
                    {participating.map((card) => (
                      <li key={card.id}>
                        <LiveSlotCard card={card} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
