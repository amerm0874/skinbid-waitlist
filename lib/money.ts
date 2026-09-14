import { BID_STEP_CENTS, FLOOR_CENTS } from "@/lib/config";

export function centsToUsd(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function nextBidCents(currentHeldCents: number | null) {
  if (!currentHeldCents || currentHeldCents < FLOOR_CENTS) {
    return FLOOR_CENTS;
  }
  return currentHeldCents + BID_STEP_CENTS;
}

// First ask is $100. Occupied zone is current + $100. Matches Whop.
export function advertisePriceLabel(currentHeldCents: number | null) {
  return centsToUsd(nextBidCents(currentHeldCents));
}
