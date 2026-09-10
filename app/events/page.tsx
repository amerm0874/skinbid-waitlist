import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductNav } from "@/components/product/ProductNav";
import { auctionClosesAt } from "@/lib/auction";

export const metadata: Metadata = {
  title: "Events",
};

export default async function EventsPage() {
  const { supabase, user, profile } = await getSessionUser();

  let events: Array<{
    id: string;
    name: string;
    date: string;
    city: string | null;
    sport: string | null;
    slug: string;
    athlete_id: string;
  }> = [];

  if (supabase) {
    const { data } = await supabase
      .from("events")
      .select("id, name, date, city, sport, slug, athlete_id")
      .in("status", ["live", "closed"])
      .order("date", { ascending: true });
    events = data ?? [];
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user?.email} />
      <main className="site-wrap py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="display text-[40px] md:text-[56px]">Live events</h1>
            <p className="mt-2 text-[14px] text-muted">
              Auction a zone. Money sits with SkinBid until proof.
            </p>
          </div>
          {profile?.role === "athlete" ? (
            <Link href="/new" className="btn btn-solid">
              List event
            </Link>
          ) : null}
        </div>

        {events.length === 0 ? (
          <p className="mt-12 max-w-md text-[15px] text-muted">
            No live events yet. Athletes list a date. Brands wait. You can still
            open the demo cage at{" "}
            <Link href="/e/demo" className="text-accent">
              /e/demo
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/e/${event.slug}`}
                  className="flex flex-col gap-1 py-4 md:flex-row md:items-baseline md:justify-between"
                >
                  <span className="text-[18px] font-semibold">{event.name}</span>
                  <span className="font-mono text-[12px] text-muted">
                    {event.city ?? "—"} · {event.sport ?? "—"} ·{" "}
                    {new Date(event.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · close "}
                    {auctionClosesAt(event.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
