"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { useEffect, useState } from "react";
import {
  auctionClockView,
  countdownParts,
  parseEventStart,
  type ClockPart,
} from "@/lib/auction";

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

function ClockReel({ parts }: { parts: ClockPart[] }) {
  return (
    <NumberFlowGroup>
      <div className="auction-clock-reel">
        {parts.map((part, index) => (
          <span key={part.u} className="auction-clock-cell">
            {index > 0 ? (
              <span className="auction-clock-colon" aria-hidden="true">
                :
              </span>
            ) : null}
            <span className="auction-clock-pair">
              <NumberFlow
                className="auction-clock-n"
                value={part.n}
                trend={-1}
                willChange
                digits={clockDigits(part.u)}
                format={{ minimumIntegerDigits: 2 }}
                transformTiming={CLOCK_SPIN}
                spinTiming={CLOCK_SPIN}
              />
              <span className="auction-clock-u">{part.u}</span>
            </span>
          </span>
        ))}
      </div>
    </NumberFlowGroup>
  );
}

export function AuctionClock({
  eventDate,
  demo = false,
  className,
}: {
  eventDate?: string | null;
  demo?: boolean;
  className?: string;
}) {
  const canTick = !demo && Boolean(parseEventStart(eventDate));
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!canTick) {
      return;
    }
    const start = window.setTimeout(() => setNow(Date.now()), 0);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
    };
  }, [canTick]);

  const view = auctionClockView(eventDate, now, { demo });
  const classes = [
    "auction-clock",
    view.kind === "closed" ? "is-closed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const parts =
    view.kind === "countdown" && eventDate && now != null
      ? countdownParts(eventDate, now)
      : null;

  return (
    <div
      className={classes}
      role="timer"
      aria-label={
        view.kind === "countdown"
          ? `Auction closes in ${view.label}`
          : view.kind === "closed"
            ? "Auction closed"
            : view.label
      }
    >
      {parts ? <ClockReel parts={parts} /> : view.label}
    </div>
  );
}
