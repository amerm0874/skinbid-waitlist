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
            href={profile?.role === "athlete" ? "/new" : "/signup?role=athlete"}
            linkLabel="Be first"
          />
        )}
      </div>
    </ProductShell>
  );
}
