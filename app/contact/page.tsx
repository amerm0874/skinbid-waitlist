import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";
import { SITE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Email SkinBid about the waitlist, a race, or a brand.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <article className="site-wrap max-w-2xl py-12 md:py-16">
        <h1 className="display text-[40px] md:text-[56px]">Contact</h1>
        <p className="mt-4 max-w-md text-[15px] leading-6 text-muted">
          One inbox. Athletes, brands, press, and privacy requests all go
          here.
        </p>
        <p className="mt-6">
          <a
            href={`mailto:${SITE.email}`}
            className="text-[18px] font-semibold text-ink underline"
          >
            {SITE.email}
          </a>
        </p>
        <p className="mt-6 text-[14px] leading-6 text-muted">
          Say if you are an athlete or a brand. Include the event name and date
          if you have one. We read every mail. We do not take phone calls yet.
        </p>
      </article>
    </SiteShell>
  );
}
