import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { loadLiveSlotCards } from "@/lib/live-listings";
import {
  ATHLETES_INDEX_DESCRIPTION,
  ATHLETES_INDEX_TITLE,
  shareMetadata,
} from "@/lib/seo";
import { EmptyState } from "@/components/product/EmptyState";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { ProductShell } from "@/components/product/ProductShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = shareMetadata(
  ATHLETES_INDEX_TITLE,
  ATHLETES_INDEX_DESCRIPTION,
  "/athletes",
);

export default async function AthletesPage() {
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/athletes");
  if (gate) {
    redirect(gate);
  }

  const athletes = await loadLiveSlotCards(supabase);

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        <div className="board-intro">
          <h1 className="page-title">Meet your next athlete.</h1>
          <p className="page-lead">
            Find an athlete. Open their photo. Put your brand in the action.
          </p>
        </div>
        <div className="discovery-guide" aria-label="How sponsorship works">
          <span><b>1</b> Choose an athlete</span>
          <span><b>2</b> Bid on a body placement</span>
          <span><b>3</b> Pay & add your logo</span>
        </div>
        <div className="collection-heading">
          <h2>Open for sponsorship</h2>
          <span>{athletes.length} {athletes.length === 1 ? "athlete" : "athletes"}</span>
        </div>
        {athletes.length > 0 ? (
          <ul className="live-body-list">
            {athletes.map((card, index) => (
              <li key={card.id}>
                <LiveSlotCard card={card} eager={index < 2} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            line="No athletes listed yet."
            href={profile?.role === "athlete" ? "/new" : "/e/demo"}
            linkLabel={profile?.role === "athlete" ? "List your race" : "Explore the demo"}
          />
        )}
      </div>
    </ProductShell>
  );
}
