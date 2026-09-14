import Link from "next/link";

// Demo cage only. Live /e/[slug] pages take Bid $100. Do not say the
// marketplace is closed.
export function BidGate() {
  return (
    <div className="bid-gate">
      <h2 className="bid-gate-title display">Demo — bidding is not open.</h2>
      <p className="bid-gate-sub">
        This page does not take bids. Live events take Bid $100.
      </p>
      <Link href="/events" className="cta-press cta-press-full bid-gate-cta">
        <span className="cta-press-plate" aria-hidden="true" />
        <span className="cta-press-face">See live events</span>
      </Link>
    </div>
  );
}
