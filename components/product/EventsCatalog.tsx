"use client";

import { useMemo, useState } from "react";
import { officialRacePath, type OfficialEvent } from "@/lib/official-events";
import { SearchIcon } from "@/components/product/Icons";
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
  heading,
  headingTag: HeadingTag = "h2",
}: {
  races: OfficialEvent[];
  heading?: string;
  headingTag?: "h1" | "h2";
}) {
  const [query, setQuery] = useState("");

  const upcoming = useMemo(() => {
    const today = todayYmd();
    return races
      .filter((row) => row.starts_on >= today)
      .sort((left, right) => left.starts_on.localeCompare(right.starts_on));
  }, [races]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return upcoming;
    }
    return upcoming.filter((row) => row.name.toLowerCase().includes(needle));
  }, [upcoming, query]);

  if (upcoming.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="slot-board-head">
        {heading ? <HeadingTag className="slot-board-kicker">{heading}</HeadingTag> : null}
        <label className="catalog-search-wrap">
          <SearchIcon size={16} />
          <input
            className="catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search races"
            aria-label="Search races"
            autoComplete="off"
          />
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="catalog-empty">No races match that search.</p>
      ) : (
        <ul className="slot-board">
          {visible.map((race) => (
            <li key={race.starts_on}>
              <RaceCard
                race={race}
                href={officialRacePath(race.starts_on)}
                variant="row"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
