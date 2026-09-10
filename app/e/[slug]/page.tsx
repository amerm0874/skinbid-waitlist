import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { DEMO_EVENT, DEMO_SLUG } from "@/lib/demo-event";
import { ZONE_NAMES, type ZoneName } from "@/lib/zones";
import { ProductNav } from "@/components/product/ProductNav";
import EventStage, { type StageZone } from "@/components/product/EventStage";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getSessionUser();

  let athleteName = DEMO_EVENT.athlete_name;
  let eventName = DEMO_EVENT.name;
  let eventDate = DEMO_EVENT.date;
  let glbUrl = DEMO_EVENT.glb_url;
  let zones: StageZone[] = ZONE_NAMES.map((name) => ({
    id: `demo-${name}`,
    name,
    status: "open",
    occupied: false,
    current_cents: null,
  }));
  let found = slug === DEMO_SLUG;

  if (supabase) {
    const { data: event } = await supabase
      .from("events")
      .select(
        "id, name, date, slug, athlete_id, likeness_opt_in, status",
      )
      .eq("slug", slug)
      .maybeSingle();

    if (event) {
      found = true;
      eventName = event.name;
      eventDate = event.date;
      const { data: athlete } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", event.athlete_id)
        .maybeSingle();
      athleteName = athlete?.name ?? "Athlete";

      const { data: avatar } = await supabase
        .from("avatars")
        .select("glb_url, ready")
        .eq("athlete_id", event.athlete_id)
        .maybeSingle();
      if (avatar?.ready && avatar.glb_url) {
        glbUrl = avatar.glb_url;
      }

      const { data: zoneRows } = await supabase
        .from("zones")
        .select("id, name, status")
        .eq("event_id", event.id);

      const zoneIds = (zoneRows ?? []).map((row) => row.id);
      const { data: bids } = zoneIds.length
        ? await supabase
            .from("bids")
            .select("zone_id, amount_cents, status, brand_id")
            .in("zone_id", zoneIds)
            .in("status", ["held", "won"])
        : { data: [] as Array<{ zone_id: string; amount_cents: number; status: string; brand_id: string }> };

      const heldByZone = new Map<string, { amount_cents: number; brand_id: string }>();
      for (const bid of bids ?? []) {
        const current = heldByZone.get(bid.zone_id);
        if (!current || bid.amount_cents >= current.amount_cents) {
          heldByZone.set(bid.zone_id, {
            amount_cents: bid.amount_cents,
            brand_id: bid.brand_id,
          });
        }
      }

      const brandIds = [...new Set([...heldByZone.values()].map((item) => item.brand_id))];
      const { data: brands } = brandIds.length
        ? await supabase
            .from("profiles")
            .select("id, name, logo_url")
            .in("id", brandIds)
        : { data: [] as Array<{ id: string; name: string | null; logo_url: string | null }> };
      const brandMap = new Map((brands ?? []).map((row) => [row.id, row]));

      zones = (zoneRows ?? []).map((row) => {
        const held = heldByZone.get(row.id);
        const brand = held ? brandMap.get(held.brand_id) : null;
        return {
          id: row.id,
          name: row.name as ZoneName,
          status: row.status as "open" | "closed",
          occupied: Boolean(held),
          current_cents: held?.amount_cents ?? null,
          brandLabel: brand?.name ?? null,
          logoUrl: brand?.logo_url ?? null,
        };
      });
    }
  }

  if (!found) {
    notFound();
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user?.email} />
      <EventStage
        slug={slug}
        athleteName={athleteName}
        eventName={eventName}
        eventDate={eventDate}
        glbUrl={glbUrl}
        zones={zones}
        canBid={profile?.role === "brand"}
        loginHref={user ? "/onboarding" : "/login"}
      />
    </div>
  );
}
