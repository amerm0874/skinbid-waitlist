import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { SITE } from "@/lib/config";

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/waitlist", label: "Waitlist" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function LandingNav() {
  return (
    <header className="site-header">
      <Wordmark />
      <nav className="nav-links">
        <Link href="/waitlist">Join waitlist</Link>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="site-wrap flex flex-col gap-8 py-10 md:flex-row md:items-end md:justify-between">
        <div>
          <Wordmark size="footer" />
          <p className="mt-3 max-w-[22ch] text-[13px] leading-5 text-muted">
            Race-day body slots. Brands bid.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted"
        >
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
          <a href={`mailto:${SITE.email}`} className="hover:text-ink">
            {SITE.email}
          </a>
        </nav>
      </div>
    </footer>
  );
}
