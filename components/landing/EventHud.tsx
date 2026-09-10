"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FLOOR_CENTS } from "@/lib/config";
import {
  type DemoAthlete,
  type SlotId,
  countdownParts,
  demoEventDateIso,
  getSlotBid,
  paidCents,
} from "@/lib/demo-landing";
import { centsToUsd } from "@/lib/money";

type SlotRow = {
  id: SlotId;
  label: string;
};

type Props = {
  athlete: DemoAthlete;
  slots: SlotRow[];
  selected?: SlotId;
  slotsOpen: boolean;
  panelOpen: boolean;
  onSelect: (id: SlotId) => void;
  onOpenSlots: () => void;
  onCloseSlots: () => void;
};

// Overlay chrome for the waitlist 3D preview.
export default function EventHud({
  athlete,
  slots,
  selected,
  slotsOpen,
  panelOpen,
  onSelect,
  onOpenSlots,
  onCloseSlots,
}: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
    };
  }, []);

  const eventDateIso = now
    ? demoEventDateIso(athlete.daysOut, new Date(now))
    : null;
  const parts = eventDateIso && now ? countdownParts(eventDateIso, now) : null;

  return (
    <>
      {/* Title + clock share one row so they cannot sit on top of each other. */}
      <div className="hud-top">
        <div className="hud-tl">
          <h2 className="hud-title display">
            Sponsor my next {athlete.sport} race
          </h2>
          <p className="hud-paid">
            I&apos;m paid {centsToUsd(paidCents(athlete))} to race {athlete.sport}.
          </p>
          <p className="hud-next">
            My next race is{" "}
            <a
              href={athlete.eventHref}
              className="hud-event"
              target="_blank"
              rel="noreferrer"
            >
              {athlete.event}
            </a>
            .
          </p>
          <p className="hud-meta">
            <a href="#how" className="hud-how">
              How it works?
            </a>
          </p>
        </div>

        <div className="hud-tr">
          {parts ? (
            <HudClock parts={parts} />
          ) : (
            <p className="font-mono text-[13px] text-muted">—</p>
          )}
        </div>
      </div>

      <div className="hud-floor">
        <div className="hud-left">
          {/* Athlete plate: name on country, then a stats table. */}
          <article className="hud-stats hud-panel">
            <header className="hud-stats-head">
              <img
                className="hud-stats-flag"
                src={`/flags/${athlete.countryCode.toLowerCase()}.svg`}
                alt=""
                width={22}
                height={16}
              />
              <div className="hud-stats-who">
                <p className="hud-stats-name">{athlete.fullName}</p>
                <p className="hud-stats-country">{athlete.country}</p>
              </div>
              <span className="hud-stats-code">{athlete.countryCode}</span>
            </header>
            <table>
              <tbody>
                <tr>
                  <th scope="row">Age</th>
                  <td>{athlete.age}</td>
                </tr>
                <tr>
                  <th scope="row">Height</th>
                  <td>
                    {athlete.heightCm}
                    <span className="hud-stats-unit"> cm</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Weight</th>
                  <td>
                    {athlete.weightKg}
                    <span className="hud-stats-unit"> kg</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">City</th>
                  <td>{athlete.city}</td>
                </tr>
                <tr>
                  <th scope="row">Sport</th>
                  <td>{athlete.sport}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>

        <div className="hud-mid">
          {panelOpen ? null : (
            <div className="hud-cta">
              <button
                type="button"
                className="press-btn"
                aria-expanded={slotsOpen}
                aria-controls="hud-slot-panel"
                onClick={onOpenSlots}
              >
                <span className="press-btn-plate" aria-hidden="true" />
                <span className="press-btn-face">Advertise your brand</span>
              </button>
            </div>
          )}
        </div>

        <div className="hud-right">
          {slotsOpen ? (
            <div className="hud-sheet hud-panel" id="hud-slot-panel">
              <div className="hud-sheet-head">
                <p className="eyebrow">Slots</p>
                <button
                  type="button"
                  className="hud-pitch-close"
                  onClick={onCloseSlots}
                  aria-label="Close slots list"
                >
                  ×
                </button>
              </div>
              <div className="hud-slot-list" aria-label="Slots">
                {slots.map((slot) => {
                  const slotBid = getSlotBid(athlete, slot.id);
                  const on = selected === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      className={
                        on
                          ? "press-btn hud-slot-btn"
                          : "press-btn press-btn-idle hud-slot-btn"
                      }
                      onClick={() => onSelect(slot.id)}
                    >
                      <span className="press-btn-plate" aria-hidden="true" />
                      <span className="press-btn-face hud-slot-face">
                        <span>{slot.label}</span>
                        <span className="hud-slot-price">
                          {slotBid.cents ? centsToUsd(slotBid.cents) : "—"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="hud-sheet-copy">
                Floor {centsToUsd(FLOOR_CENTS)}. Preview, not live.
              </p>
            </div>
          ) : null}

          <Link className="hud-athlete" href="/waitlist">
            <span className="hud-avatar">
              <img src={athlete.photo} alt="" />
            </span>
            <span className="hud-athlete-copy">
              <span className="hud-social">
                I&apos;m {athlete.social}{" "}
                <span className="hud-social-arrow" aria-hidden="true">
                  ↗
                </span>
              </span>
              <span className="hud-social-meta">
                ({athlete.followers} on Instagram)
              </span>
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}

type ClockPart = {
  n: number;
  u: string;
};

// Apple-style reel: digits always fall down. Minutes/seconds wrap 59 → 00.
const CLOCK_SPIN = {
  duration: 700,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
};

function clockDigits(unit: string) {
  if (unit === "m" || unit === "s") {
    return { 1: { max: 5 } };
  }
  if (unit === "h") {
    return { 1: { max: 2 } };
  }
  return undefined;
}

function HudClock({ parts }: { parts: ClockPart[] }) {
  return (
    <NumberFlowGroup>
      <div className="hud-clock" aria-label="Time until auction close">
        {parts.map((part, index) => (
          <span key={part.u} className="hud-clock-cell">
            {index > 0 ? (
              <span className="hud-clock-colon" aria-hidden="true">
                :
              </span>
            ) : null}
            <span className="hud-clock-pair">
              <NumberFlow
                className="hud-clock-n"
                value={part.n}
                trend={-1}
                willChange
                digits={clockDigits(part.u)}
                format={{ minimumIntegerDigits: 2 }}
                transformTiming={CLOCK_SPIN}
                spinTiming={CLOCK_SPIN}
              />
              <span className="hud-clock-u">{part.u}</span>
            </span>
          </span>
        ))}
      </div>
    </NumberFlowGroup>
  );
}
