import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { brandOnboardingComplete } from "@/lib/config";
import { closeEventAuction } from "@/lib/close-auctions";
import { DEMO_EVENT, DEMO_GLB, DEMO_SLUG } from "@/lib/demo-event";
import { polarPaymentsEnabled } from "@/lib/polar-enabled";
import { isReadyAvatar } from "@/lib/event-create";
import { loadEventSeo } from "@/lib/public-listings";
import { isPublishedEventStatus } from "@/lib/types";
import {
  eventOfferJsonLd,
  eventPageDescription,
  eventPageTitle,
  shareMetadata,
} from "@/lib/seo";
import { ZONE_NAMES } from "@/lib/zones";
import { ProductShell } from "@/components/product/ProductShell";
import EventStage, { type StageZone } from "@/components/product/EventStage";
import { JsonLd } from "@/components/seo/JsonLd";
import { loadLastBidsByZone, type ZoneBidItem } from "@/lib/zone-bids";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug === DEMO_SLUG) {
    const title = eventPageTitle(
      DEMO_EVENT.athlete_name,
      DEMO_EVENT.name,
      DEMO_EVENT.date,
    );
    const description = eventPageDescription(
      DEMO_EVENT.athlete_name,
      DEMO_EVENT.name,
      DEMO_EVENT.date,
    );
    return {
      ...shareMetadata(title, description, `/e/${slug}`),
      robots: { index: false, follow: false },
    };
  }

  const event = await loadEventSeo(slug);
  if (!event) {
    return {
      title: { absolute: "Not found | SkinBid" },
      robots: { index: false, follow: false },
      openGraph: null,
      twitter: null,
    };
  }

  const title = eventPageTitle(event.athleteName, event.eventName, event.date);
  const description = eventPageDescription(
    event.athleteName,
    event.eventName,
    event.date,
  );
  return shareMetadata(title, description, `/e/${event.slug}`);
}

function emptyZones(): StageZone[] {
  return ZONE_NAMES.map((name) => ({
    id: `demo-${name}`,
    name,
    status: "open",
    occupied: false,
    current_cents: null,
  }));
}

export default async function EventPage({ params }: PageProps) {
  const { slug } = await params;
  const { supabase, user, profile } = await getSessionUser();

  let eventId: string | undefined;
  let athleteId: string | undefined;
  let athleteName = DEMO_EVENT.athlete_name;
  let eventName = DEMO_EVENT.name;
  let eventDate = DEMO_EVENT.date;
  let eventCity: string | null = DEMO_EVENT.city;
  let glbUrl = "";
  let zones: StageZone[] = emptyZones();
  let zoneBids: Record<string, ZoneBidItem[]> = {};
  let found = false;

  if (slug === DEMO_SLUG) {
    found = true;
    glbUrl = DEMO_GLB;
  } else if (supabase) {
    const { data: event } = await supabase
      .from("events")
      .select("id, name, date, city, slug, athlete_id, likeness_opt_in, status")
      .eq("slug", slug)
      .maybeSingle();

    // Draft, cancelled, or no ready GLB → 404. Demo uses the landing Alex GLB.
    const { data: avatar } =
      event && isPublishedEventStatus(event.status)
        ? await supabase
            .from("avatars")
            .select("glb_url, ready")
            .eq("athlete_id", event.athlete_id)
            .maybeSingle()
        : { data: null };

    if (event && isPublishedEventStatus(event.status) && isReadyAvatar(avatar)) {
      found = true;
      eventId = event.id;
      athleteId = event.athlete_id;
      eventName = event.name;
      eventDate = event.date;
      eventCity = event.city ?? null;
      glbUrl = avatar.glb_url;

      // Settle winners as soon as the page loads past T–48h. Do not wait on cron.
      if (event.status === "live" && isAuctionClosed(event.date)) {
        await closeEventAuction(event.id);
        event.status = "closed";
      }
      const { data: athlete } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", event.athlete_id)
        .maybeSingle();
      athleteName = athlete?.name ?? "Athlete";

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

      const heldByZone = new Map<
        string,
        { amount_cents: number; brand_id: string; status: "held" | "won" }
      >();
      for (const bid of bids ?? []) {
        if (bid.status !== "held" && bid.status !== "won") {
          continue;
        }
        const current = heldByZone.get(bid.zone_id);
        if (!current || bid.amount_cents >= current.amount_cents) {
          heldByZone.set(bid.zone_id, {
            amount_cents: bid.amount_cents,
            brand_id: bid.brand_id,
            status: bid.status,
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
      const rowByName = new Map((zoneRows ?? []).map((row) => [row.name, row]));

      // Always 12 named zones, even if a row is missing.
      zones = ZONE_NAMES.map((name) => {
        const row = rowByName.get(name);
        const held = row ? heldByZone.get(row.id) : undefined;
        const brand = held ? brandMap.get(held.brand_id) : null;
        return {
          id: row?.id ?? `missing-${name}`,
          name,
          status: (row?.status as "open" | "closed") ?? "closed",
          occupied: Boolean(held),
          current_cents: held?.amount_cents ?? null,
          leadStatus: held?.status ?? null,
          brandId: held?.brand_id ?? null,
          brandLabel: brand?.name ?? null,
          logoUrl: brand?.logo_url ?? null,
        };
      });
      zoneBids = await loadLastBidsByZone(
        supabase,
        zones.map((zone) => zone.id),
      );
    }
  }

  if (!found) {
    notFound();
  }

  return (
    <ProductShell email={user?.email} role={profile?.role} flush>
      <JsonLd
        data={eventOfferJsonLd({
          athleteName,
          eventName,
          dateIso: eventDate,
          slug,
          city: eventCity,
          openCount: zones.filter((zone) => zone.status === "open").length,
        })}
      />
      <EventStage
        slug={slug}
        eventId={eventId}
        athleteName={athleteName}
        eventName={eventName}
        eventDate={eventDate}
        glbUrl={glbUrl}
        zones={zones}
        canBid={brandOnboardingComplete(profile)}
        role={profile?.role ?? null}
        acceptsBids={Boolean(eventId) && slug !== DEMO_SLUG}
        paymentsReady={polarPaymentsEnabled()}
        isOwner={Boolean(user && athleteId && user.id === athleteId)}
        loginHref={user ? "/onboarding" : "/login"}
        brandName={profile?.role === "brand" ? profile.name : null}
        currentBrandId={profile?.role === "brand" ? profile.id : null}
        brandLogoUrl={profile?.role === "brand" ? profile.logo_url : null}
        zoneBids={zoneBids}
      />
    </ProductShell>
  );
}
