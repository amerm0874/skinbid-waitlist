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
      line: "Almost done. Finish your photos and placements, then publish your race.",
      action: { href: "/new", label: "Finish listing" },
    };
  }

  if (proof === "approved") {
    return { phase: "approved", line: "Proof approved.", action: null };
  }
  if (proof === "pending") {
    return { phase: "proof_pending", line: "Your race-day proof is being reviewed.", action: null };
  }
  if (proof === "rejected") {
    return { phase: "rejected", line: "Your proof needs another look. Upload clearer race-day photos.", action: proofAction };
  }

  if (listingClosed && isEventOver(input.eventDate, now)) {
    if (input.hasWonZone || input.hasBids) {
      return { phase: "upload_proof", line: "Upload proof.", action: proofAction };
    }
    return { phase: "upload_proof", line: "Event ended.", action: null };
  }

  if (listingClosed) {
    if (input.hasWonZone || input.hasBids) {
      return { phase: "wear", line: "Your sponsors are confirmed. Download their logos and wear them on race day.", action: eventAction };
    }
    return { phase: "wear", line: "Auction closed.", action: eventAction };
  }

  if (input.hasBids) {
    return { phase: "live_bids", line: "Brands are bidding. Follow your placements and current leading bids below.", action: eventAction };
  }

  return { phase: "live_empty", line: "You’re live. Share your athlete profile to help brands find your race.", action: eventAction };
}

export function logoPrintLine(zoneLabel: string) {
  return `Print ~8–12cm on ${zoneLabel}.`;
}

export function logoDownloadName(zoneName: string) {
  return `${zoneName}.png`;
}
