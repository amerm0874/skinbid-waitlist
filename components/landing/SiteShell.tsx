import { LandingFooter, LandingNav } from "@/components/landing/LandingChrome";

// Shared chrome for public pages: same header and footer as the landing.
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-bg">
      <LandingNav />
      {children}
      <LandingFooter />
    </div>
  );
}
