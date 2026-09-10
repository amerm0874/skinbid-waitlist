import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";
import { SITE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Rules for using SkinBid: waitlist today, body slots and payouts later.",
};

export default function TermsPage() {
  return (
    <SiteShell>
      <article className="site-wrap max-w-2xl py-12 md:py-16">
        <h1 className="display text-[40px] md:text-[56px]">Terms of use</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated: 10 September 2026</p>

        <div className="mt-8 space-y-4 text-[15px] leading-6 text-muted">
          <p>
            These terms cover the SkinBid website and waitlist. The live
            marketplace is not open yet. When auctions go live we may add
            extra rules. If you do not agree, do not use the site.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">What SkinBid is</h2>
          <p>
            SkinBid is a marketplace for temporary logo tattoos on an
            athlete’s body for one dated event. Brands pay SkinBid. The
            athlete wears the tattoo on the day, then sends proof photos. We
            are not an agency, not a tattoo shop, and not affiliated with any
            race organizer.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Waitlist</h2>
          <p>
            Joining the waitlist does not book a slot, start an auction, or
            move money. It is a request for an email when we open. We can
            accept, delay, or close the list at any time.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">When events open</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Temporary tattoos only. No permanent ink through SkinBid.</li>
            <li>
              Brands pay SkinBid. We hold the money until the event is done
              and we approve proof.
            </li>
            <li>Auction only. Floor $100 unless we say otherwise.</li>
            <li>
              If the athlete no-shows or proof fails, the brand is refunded.
            </li>
            <li>
              Organizers set their own logo rules. A slot on SkinBid does not
              override a race’s rules.
            </li>
          </ul>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Your content</h2>
          <p>
            You must own the photos and names you send us. Do not list a body
            or a brand you do not control. You must be 18 or older.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">The site</h2>
          <p>
            We provide the site “as is.” We are not liable for lost profit,
            race results, or organizer bans. The 3D figure on the landing
            page is a demo of slots, not a live inventory.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Contact</h2>
          <p>
            Questions:{" "}
            <a className="text-ink underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
            .
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
