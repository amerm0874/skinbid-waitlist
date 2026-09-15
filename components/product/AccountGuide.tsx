import Link from "next/link";

const GUIDES = {
  athlete: [
    { title: "Make it personal", detail: "Complete your profile, upload front and back photos, and record a short introduction. Review your AI-prepared photos before using them.", href: "/me#athlete-media", action: "Set up photos & video" },
    { title: "Choose your placements", detail: "Pick each sponsorship placement and position it on your own photos. You decide where a brand can appear.", href: "/me#placements", action: "Position placements" },
    { title: "Go live for your race", detail: "Choose your race and publish. Follow bids here, then upload proof of the sponsorship after race day.", href: "/new", action: "Set up your race" },
  ],
  brand: [
    { title: "Introduce your brand", detail: "Add your brand name, website, category and logo before placing a bid.", href: "/settings", action: "Edit brand profile" },
    { title: "Find your athlete", detail: "Choose a race and athlete. Open their photo to compare placements and review the bid price.", href: "/events", action: "Explore races" },
    { title: "Bid & add your artwork", detail: "Pay for your bid, then upload your logo from your account. The highest bid at the deadline wins.", href: "/me#account-activity", action: "View your bids" },
  ],
} as const;

export function AccountGuide({ role }: { role: "athlete" | "brand" }) {
  return (
    <section className="account-guide" aria-labelledby="account-guide-title">
      <div className="account-guide-heading"><h2 id="account-guide-title">{role === "athlete" ? "Your path to sponsorship" : "Your first sponsorship"}</h2><p>Three steps. Everything stays in your account.</p></div>
      <ol>{GUIDES[role].map((step, index) => <li key={step.title}><span className="account-guide-number" aria-hidden="true">{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p><Link href={step.href}>{step.action}</Link></div></li>)}</ol>
    </section>
  );
}
