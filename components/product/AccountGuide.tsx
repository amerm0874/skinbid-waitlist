import Link from "next/link";

const GUIDES = {
  athlete: [
    {
      title: "Add photos and a short video",
      detail: "Complete your profile, upload front and back photos, and record a short introduction. Review the prepared photos before you use them.",
      href: "/me#athlete-media",
      action: "Set up photos & video",
    },
    {
      title: "Mark your placements",
      detail: "Choose each sponsorship placement and position it on your photos. You decide where a brand can appear.",
      href: "/me#placements",
      action: "Position placements",
    },
    {
      title: "List your race",
      detail: "Choose your race and publish. Track bids here, then upload race-day photos after you wear the logos.",
      href: "/new",
      action: "Set up your race",
    },
  ],
  brand: [
    {
      title: "Introduce your brand",
      detail: "Add your brand name, website, category and logo before you place a bid.",
      href: "/settings",
      action: "Edit brand profile",
    },
    {
      title: "Find an athlete",
      detail: "Choose a race and athlete. Open their photo to compare placements and see the current bid.",
      href: "/events",
      action: "Explore races",
    },
    {
      title: "Place a bid, then add your logo",
      detail: "Pay to place your bid, then upload your logo from your account. The highest bid at the deadline gets the placement.",
      href: "/me#account-activity",
      action: "View your bids",
    },
  ],
} as const;

export function AccountGuide({ role }: { role: "athlete" | "brand" }) {
  return (
    <section className="account-guide" aria-labelledby="account-guide-title">
      <div className="account-guide-heading">
        <h2 id="account-guide-title">
          {role === "athlete" ? "Your path to sponsorship" : "Your first sponsorship"}
        </h2>
        <p>Three steps. Stay in your account the whole way.</p>
      </div>
      <ol>
        {GUIDES[role].map((step, index) => (
          <li key={step.href}>
            <span className="account-guide-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="account-guide-copy">
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
              <Link href={step.href} className="account-guide-action">
                {step.action}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
