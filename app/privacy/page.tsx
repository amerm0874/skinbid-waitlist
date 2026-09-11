import type { Metadata } from "next";
import SiteShell from "@/components/landing/SiteShell";
import { SITE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How SkinBid collects and uses information on the waitlist.",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <article className="site-wrap max-w-2xl py-12 md:py-16">
        <h1 className="display text-[40px] md:text-[56px]">Privacy</h1>
        <p className="mt-2 text-[13px] text-muted">Last updated: 10 September 2026</p>

        <div className="mt-8 space-y-4 text-[15px] leading-6 text-muted">
          <p>
            SkinBid ({SITE.url}) is a waitlist for event-day body ad slots.
            This page explains what we collect and why. If you have a
            question, email{" "}
            <a className="text-ink underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
            .
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">What we collect</h2>
          <p>When you join the waitlist we store:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name</li>
            <li>Your email</li>
            <li>A public social handle</li>
            <li>Your sport, if you joined as an athlete</li>
            <li>The body slot you clicked, if you joined from the 3D figure</li>
          </ul>
          <p>
            Our forms also include a hidden field to catch bots. We do not
            use that field for real people.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">How we use it</h2>
          <p>We use this information to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Email you when we open</li>
            <li>Reply if you write to us</li>
          </ul>
          <p>We do not sell your email. We do not run ads against this list.</p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Who sees it</h2>
          <p>
            We store waitlist data in Supabase. We send mail with Resend. If
            we turn on Plausible, that tool counts page views without ads or
            cross-site tracking.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">How long we keep it</h2>
          <p>
            We keep waitlist emails until you ask us to delete them, or until
            we shut the list down. Email {SITE.email} and we will delete your
            row.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Cookies</h2>
          <p>
            The site needs a few cookies to stay signed in later and to keep
            the page working. We do not use advertising cookies.
          </p>

          <h2 className="pt-4 text-[18px] font-semibold text-ink">Age</h2>
          <p>
            SkinBid is for people 18 or older. Do not join the waitlist if you
            are under 18.
          </p>
        </div>
      </article>
    </SiteShell>
  );
}
