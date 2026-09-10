import AthleteBrandSplit from "@/components/landing/AthleteBrandSplit";
import BodyViewerSection from "@/components/landing/BodyViewerSection";
import ChampionshipTicker from "@/components/landing/ChampionshipTicker";
import FaqSection from "@/components/landing/FaqSection";
import HeroBody from "@/components/landing/HeroBody";
import {
  LandingFooter,
  LandingNav,
} from "@/components/landing/LandingChrome";
import {
  DRACO_WASM,
  DRACO_WRAPPER,
  HERO_SRC,
  MODEL_SRC,
} from "@/lib/landing-media";

const STEPS = [
  {
    n: "01",
    title: "List the event",
    body: "Date, photo, slots. Any sport. You close zones you cannot sell.",
  },
  {
    n: "02",
    title: "Brand pays SkinBid",
    body: "Money is held. Not sent to you yet. Auction only. Floor $100.",
  },
  {
    n: "03",
    title: "Wear it on the day",
    body: "Temp tattoo in the bought zone. One day. Then it comes off.",
  },
  {
    n: "04",
    title: "Proof, then payout",
    body: "Photos. We check. You get paid. Fail the proof, brand is refunded.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-full bg-bg">
      {/* Start the hero photo, 3D file, and Draco decoder before React boots. */}
      <link rel="preload" href={HERO_SRC} as="image" />
      <link
        rel="preload"
        href={MODEL_SRC.male}
        as="fetch"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href={DRACO_WASM}
        as="fetch"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href={DRACO_WRAPPER}
        as="fetch"
        crossOrigin="anonymous"
      />
      <LandingNav />

      <section className="relative flex min-h-[calc(100svh-var(--nav-h))] flex-col">
        <div className="site-wrap grid min-h-0 flex-1 items-center gap-8 py-6 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="display max-w-[11em] text-[40px] md:text-[64px]">
              Your next race already has ad space.
            </h1>
            <p className="mt-4 max-w-md text-[16px] leading-[1.35] text-muted md:text-[18px]">
              List logo slots on your body. Brands pay SkinBid. You wear a temp
              tattoo for one day.
            </p>
            <div className="mt-6">
              <a href="/waitlist?from=athlete" className="press-btn">
                <span className="press-btn-plate" aria-hidden="true" />
                <span className="press-btn-face">Join waitlist</span>
              </a>
            </div>
          </div>
          <HeroBody />
        </div>
        <ChampionshipTicker />
      </section>

      <BodyViewerSection />

      <section id="how" className="border-t border-line">
        <div className="site-wrap py-[var(--block-y)]">
          <h2 className="display text-[36px] md:text-[52px]">
            Four steps. No decks.
          </h2>
          <ol className="mt-10 grid gap-0 md:grid-cols-4">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="border-t border-line py-6 md:border-t-0 md:border-l md:px-5 md:py-0 first:md:border-l-0 first:md:pl-0"
              >
                <p className="font-mono text-[12px] text-accent">{step.n}</p>
                <h3 className="mt-3 text-[18px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-5 text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <AthleteBrandSplit />
      <FaqSection />

      <LandingFooter />
    </div>
  );
}
