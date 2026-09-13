import { isAuctionClosed, isEventOver } from "@/lib/auction";
import type { EventStatus } from "@/lib/types";

export type ProofStatus = "pending" | "approved" | "rejected";

export type AthleteEventPhase =
  | "draft"
  | "live_empty"
  | "live_bids"
  | "wear"
  | "upload_proof"
  | "proof_pending"
  | "approved"
  | "rejected";

export type AthleteStatusAction = {
  href: string;
  label: "Finish listing" | "Event" | "Upload proof";
};

export type AthleteStatusLine = {
  phase: AthleteEventPhase;
  line: string;
  action: AthleteStatusAction | null;
};

function isProofStatus(value: string | null | undefined): value is ProofStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function athleteEventStatus(input: {
  eventId: string;
  slug: string;
  status: EventStatus;
  eventDate: string;
  hasBids: boolean;
  hasWonZone: boolean;
  proofStatus: string | null;
  now?: Date;
}): AthleteStatusLine {
  const now = input.now ?? new Date();
  const proof = isProofStatus(input.proofStatus) ? input.proofStatus : null;
  const listingClosed =
    input.status === "closed" ||
    input.status === "done" ||
    (input.status === "live" && isAuctionClosed(input.eventDate, now));
  const eventHref = `/e/${input.slug}`;
  const proofHref = `/proof/${input.eventId}`;
  const eventAction: AthleteStatusAction = { href: eventHref, label: "Event" };
  const proofAction: AthleteStatusAction = {
    href: proofHref,
    label: "Upload proof",
  };

  if (input.status === "draft") {
    return {
      phase: "draft",
      line: "Finish the listing.",
      action: { href: "/new", label: "Finish listing" },
    };
  }

  if (proof === "approved") {
    return { phase: "approved", line: "Proof approved.", action: null };
  }
  if (proof === "pending") {
    return { phase: "proof_pending", line: "Proof is pending.", action: null };
  }
  if (proof === "rejected") {
    return { phase: "rejected", line: "Proof rejected.", action: proofAction };
  }

  if (listingClosed && isEventOver(input.eventDate, now)) {
    if (input.hasWonZone || input.hasBids) {
      return { phase: "upload_proof", line: "Upload proof.", action: proofAction };
    }
    return { phase: "upload_proof", line: "Event ended.", action: null };
  }

  if (listingClosed) {
    if (input.hasWonZone || input.hasBids) {
      return { phase: "wear", line: "Wear the mark.", action: eventAction };
    }
    return { phase: "wear", line: "Auction closed.", action: eventAction };
  }

  if (input.hasBids) {
    return { phase: "live_bids", line: "Bids are in.", action: eventAction };
  }

  return { phase: "live_empty", line: "Wait for a bid.", action: eventAction };
}

export function logoPrintLine(zoneLabel: string) {
  return `Print ~8–12cm on ${zoneLabel}.`;
}

export function logoDownloadName(zoneName: string) {
  return `${zoneName}.png`;
}
