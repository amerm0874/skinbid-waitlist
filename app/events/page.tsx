import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { loadLiveSlotCards } from "@/lib/live-listings";
import { loadAllUpcomingOfficialEvents } from "@/lib/official-events";
import {
  EVENTS_INDEX_DESCRIPTION,
  EVENTS_INDEX_TITLE,
  shareMetadata,
} from "@/lib/seo";
import { EventsCatalog } from "@/components/product/EventsCatalog";
import { LiveSlotCard } from "@/components/product/LiveSlotCard";
import { ProductShell } from "@/components/product/ProductShell";

export const metadata: Metadata = shareMetadata(
  EVENTS_INDEX_TITLE,
  EVENTS_INDEX_DESCRIPTION,
  "/events",
);

export default async function EventsPage() {
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/events");
  if (gate) {
    redirect(gate);
  }

  // Saved og_image only. Never scrape official race sites here.
  const [events, races] = await Promise.all([
    loadLiveSlotCards(supabase),
    loadAllUpcomingOfficialEvents(supabase),
  ]);

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        {events.length > 0 ? (
          <section>
            <div className="slot-board-head">
              <h1 className="slot-board-kicker">Live athletes</h1>
              {profile?.role === "athlete" ? (
                <Link href="/new" className="slot-board-action">
                  List
                </Link>
              ) : null}
            </div>
            <ul className="live-body-list">
              {events.map((event, index) => (
                <li key={event.id}>
                  <LiveSlotCard card={event} eager={index < 2} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <EventsCatalog
          races={races}
          live={events}
          asTitle={events.length === 0}
          hasLiveBodies={events.length > 0}
        />
      </div>
    </ProductShell>
  );
}
