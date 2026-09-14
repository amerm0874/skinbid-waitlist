import Link from "next/link";

// Two short columns so each side sees their deal, each to its own signup role.

export default function AthleteBrandSplit() {
  return (
    <section className="border-t border-line">
      <div className="site-wrap grid gap-0 py-[var(--block-y)] md:grid-cols-2">
        <div className="border-b border-line pb-10 md:border-b-0 md:border-r md:pr-10">
          <h2 className="display text-[36px] md:text-[52px]">Athletes</h2>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
            List a dated race. Brands bid on slots. You wear a temp tattoo for
            one day. You get paid after we check the photos. Floor $100. You
            keep 80%.
          </p>
          <Link href="/signup?role=athlete" className="press-btn mt-6">
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">List my race</span>
          </Link>
        </div>
        <div className="pt-10 md:pl-10 md:pt-0">
          <h2 className="display text-[36px] md:text-[52px]">Brands</h2>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
            Your logo on a body at a real start line. From $100. We hold the
            money until you get the photos.
          </p>
          <Link href="/signup?role=brand" className="press-btn mt-6">
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Join the first round</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
