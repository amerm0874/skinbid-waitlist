import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { groupLiveRaces, loadLiveSlotCards } from "@/lib/live-listings";
import {
  EVENTS_INDEX_DESCRIPTION,
  EVENTS_INDEX_TITLE,
  shareMetadata,
} from "@/lib/seo";
import { EmptyState } from "@/components/product/EmptyState";
import { ProductShell } from "@/components/product/ProductShell";
import { RaceListRow } from "@/components/product/RaceMeet";

export const dynamic = "force-dynamic";

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

  const races = groupLiveRaces(await loadLiveSlotCards(supabase));

  return (
    <ProductShell email={user?.email} role={profile?.role}>
      <div className="page-stack">
        {races.length > 0 ? (
          <ul className="race-meet-list">
            {races.map((race) => (
              <li key={race.key}>
                <RaceListRow
                  href={race.href}
                  name={race.name}
                  city={race.city}
                  date={race.date}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            line="No races listed yet."
            href={profile?.role === "athlete" ? "/new" : "/signup?role=athlete"}
            linkLabel="Be first"
          />
        )}
      </div>
    </ProductShell>
  );
}
