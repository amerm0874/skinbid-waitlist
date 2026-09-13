"use client";

import {
  ATHLETE_SPORTS,
  COMBAT_SPORTS,
  SPORT_DETAIL_MAX,
} from "@/lib/config";

export default function SportFields({
  sport,
  sportDetail,
  onSportChange,
  onSportDetailChange,
  sportName = "sport",
  detailName = "sport_detail",
}: {
  sport: string;
  sportDetail: string;
  onSportChange: (sport: string) => void;
  onSportDetailChange: (detail: string) => void;
  sportName?: string;
  detailName?: string;
}) {
  return (
    <>
      <label className="mt-4 block">
        <span className="field-label">Sport</span>
        <select
          className="field"
          name={sportName}
          autoComplete="off"
          required
          value={sport}
          onChange={(event) => {
            onSportChange(event.target.value);
            onSportDetailChange("");
          }}
        >
          <option value="" disabled>
            Select sport
          </option>
          {ATHLETE_SPORTS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {sport === "Combat" ? (
        <label className="mt-4 block">
          <span className="field-label">Combat sport</span>
          <select
            className="field"
            name={detailName}
            autoComplete="off"
            required
            value={sportDetail}
            onChange={(event) => onSportDetailChange(event.target.value)}
          >
            <option value="" disabled>
              Select combat sport
            </option>
            {COMBAT_SPORTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {sport === "Other" ? (
        <label className="mt-4 block">
          <span className="field-label">Sport name</span>
          <input
            className="field"
            name={detailName}
            autoComplete="off"
            required
            maxLength={SPORT_DETAIL_MAX}
            value={sportDetail}
            onChange={(event) => onSportDetailChange(event.target.value)}
          />
        </label>
      ) : null}
    </>
  );
}
