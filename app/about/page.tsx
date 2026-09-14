import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "List a race. Brands bid on logo slots. You wear a temp tattoo for one day.",
};

const STEPS = [
  {
    title: "List the event",
    body: "Date, photo, slots. Any sport. You close slots you cannot sell.",
  },
  {
    title: "Brand pays SkinBid",
    body: "Money is held. Not sent to you yet. Auction only. Floor $100.",
  },
  {
    title: "Wear it on the day",
    body: "Temp tattoo in the bought slot. One day. Then it comes off.",
  },
  {
    title: "Proof, then payout",
    body: "Photos. We check. You get paid. Fail the proof, brand is refunded.",
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <main>
        <section className="site-wrap max-w-2xl py-[var(--block-y)]">
          <h1 className="display text-[40px] md:text-[56px]">
            Your next race already has ad space.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
            List logo slots on your body. Brands pay SkinBid. You wear a temp
            tattoo for one day.
          </p>
        </section>

        <section className="site-wrap max-w-2xl py-[var(--block-y)]">
          <h2 className="display text-[36px] md:text-[52px]">
            Four steps. No pitch deck.
          </h2>
          <ol className="mt-10 grid gap-6">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <p className="font-mono text-[12px] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-[18px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-5 text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="site-wrap max-w-2xl pb-[var(--block-y)]">
          <div className="flex flex-wrap gap-3">
            <a href="/signup?role=athlete" className="press-btn">
              <span className="press-btn-plate" aria-hidden="true" />
              <span className="press-btn-face">List my race</span>
            </a>
            <a href="/signup?role=brand" className="press-btn">
              <span className="press-btn-plate" aria-hidden="true" />
              <span className="press-btn-face">Advertise my brand</span>
            </a>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}
