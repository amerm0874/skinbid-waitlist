import { isAuctionClosed } from "@/lib/auction";
import type { ZoneStatus } from "@/lib/types";

export const HELD_OR_WON = ["held", "won"] as const;

export function zoneToggleError(input: {
  from: ZoneStatus;
  to: ZoneStatus;
  hasHeldOrWon: boolean;
  eventDate: string;
  now?: Date;
}): string | null {
  if (input.from === input.to) {
    return input.to === "closed"
      ? "Zone is already closed."
      : "Zone is already open.";
  }
  if (input.to === "closed" && input.hasHeldOrWon) {
    return "Cannot close a zone that is held or won.";
  }
  if (input.to === "open" && isAuctionClosed(input.eventDate, input.now)) {
    return "Cannot reopen after T–48h.";
  }
  return null;
}

export function isZoneStatus(value: string): value is ZoneStatus {
  return value === "open" || value === "closed";
}
