import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "A brand puts their name on an athlete for one event. The athlete wears it that day. Then it comes off.",
};

const HOW_STEPS = [
  "Name the event.",
  "Wear the sponsor for one day.",
  "Send the photos.",
];

export default function AboutPage() {
  return (
    <SiteShell>
      <main>
        <section className="site-wrap max-w-2xl py-[var(--block-y)]">
          <h1 className="display text-[40px] md:text-[56px]">The idea</h1>
          <div className="mt-4 space-y-2 text-[15px] leading-6 text-muted">
            <p>A race already has cameras, a crowd, and a body people watch.</p>
            <p>SkinBid turns that day into sponsorship.</p>
            <p>
              A brand puts their name on an athlete for one event. The athlete
              wears it that day. Then it comes off.
            </p>
          </div>
        </section>

        <section className="site-wrap max-w-2xl py-[var(--block-y)]">
          <h2 className="display text-[36px] md:text-[52px]">The goal</h2>
          <div className="mt-4 space-y-2 text-[15px] leading-6 text-muted">
            <p>Athletes get a sponsor for work they already do.</p>
            <p>Brands get seen at a real start line, not in another feed post.</p>
          </div>
          <p className="mt-4 text-[16px] leading-6 text-ink">
            That is the whole product.
          </p>
        </section>

        <section className="site-wrap max-w-2xl py-[var(--block-y)]">
          <h2 className="display text-[36px] md:text-[52px]">How</h2>
          <ol className="mt-4 space-y-2 text-[15px] leading-6 text-muted">
            {HOW_STEPS.map((step, index) => (
              <li key={step}>
                <span className="mr-3 text-ink/40">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section
          id="waitlist-bottom"
          className="site-wrap max-w-2xl pb-[var(--block-y)]"
        >
          <a href="/waitlist" className="press-btn">
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Join waitlist</span>
          </a>
        </section>
      </main>
    </SiteShell>
  );
}
