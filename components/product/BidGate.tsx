import Link from "next/link";

// Demo cage only. Live /e/[slug] pages take Bid $100. Do not say the
// marketplace is closed.
export function BidGate() {
  return (
    <div className="bid-gate">
      <h2 className="bid-gate-title">You’re exploring the demo</h2>
      <p className="bid-gate-sub">
        Try the placements here. To place a bid, choose an athlete in a live event.
      </p>
      <Link href="/events" className="cta-press cta-press-full bid-gate-cta">
        <span className="cta-press-plate" aria-hidden="true" />
        <span className="cta-press-face">See live events</span>
      </Link>
    </div>
  );
}
