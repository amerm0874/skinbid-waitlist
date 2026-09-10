import Link from "next/link";

// Two short columns so each side sees their deal. Both go to /waitlist.

export default function AthleteBrandSplit() {
  return (
    <section className="border-t border-line">
      <div className="site-wrap grid gap-0 py-[var(--block-y)] md:grid-cols-2">
        <div className="border-b border-line pb-10 md:border-b-0 md:border-r md:pr-10">
          <h2 className="display text-[36px] md:text-[52px]">Athletes</h2>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
            List a dated event. Brands bid on zones. You wear a temp tattoo for
            one day. You get paid after we check the photos.
          </p>
          <Link href="/waitlist?from=athlete" className="press-btn mt-6">
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Join as athlete</span>
          </Link>
        </div>
        <div className="pt-10 md:pl-10 md:pt-0">
          <h2 className="display text-[36px] md:text-[52px]">Brands</h2>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
            Pick a zone. Bid from $100. Money sits with SkinBid until proof.
            You get the race-day photo.
          </p>
          <Link href="/waitlist?from=brand" className="press-btn mt-6">
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Join as brand</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
