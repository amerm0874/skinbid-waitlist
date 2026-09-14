import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAuctionClosed } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import {
  brandOnboardingComplete,
  canAdvertiseOnEvent,
  loginPath,
  onboardingPath,
} from "@/lib/config";
import { closeEventAuction } from "@/lib/close-auctions";
import { DEMO_EVENT, DEMO_GLB, DEMO_SLUG } from "@/lib/demo-event";
import { ensureEventZoneRows, isReadyAvatar } from "@/lib/event-create";
import { loadDemoZoneLogos } from "@/lib/event-logo";
import { loadBodyPhotos, type BodyPhotos } from "@/lib/body-photos";
import { publicAthleteHandle } from "@/lib/handle";
import { createAdminSupabase } from "@/lib/supabase/admin";
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
import { holdPaidPendingBids } from "@/lib/hold-bid";
import { loadLastBidsByZone, loadLeadsByZone, type ZoneBidItem } from "@/lib/zone-bids";

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
  let athleteHandle: string | null = null;
  let eventName = DEMO_EVENT.name;
  let eventDate = slug === DEMO_SLUG ? DEMO_EVENT.date : "";
  let eventCity: string | null = DEMO_EVENT.city;
  let glbUrl = "";
  let zones: StageZone[] = emptyZones();
  let zoneBids: Record<string, ZoneBidItem[]> = {};
  let bodyPhotos: BodyPhotos = { front: null, back: null };
  let found = false;

  if (slug === DEMO_SLUG) {
    found = true;
    glbUrl = DEMO_GLB;
    bodyPhotos = { front: "/body/front.jpg", back: "/body/back.jpg" };
    const demoLogos = await loadDemoZoneLogos();
    zones = ZONE_NAMES.map((name) => {
      const logoUrl = demoLogos.get(name) ?? null;
      return {
        id: `demo-${name}`,
        name,
        status: "open",
        occupied: Boolean(logoUrl),
        current_cents: null,
        brandLabel: logoUrl ? "Demo brand" : null,
        logoUrl,
      };
    });
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
      bodyPhotos = await loadBodyPhotos(event.athlete_id);

      // Settle winners as soon as the page loads past T–48h. Do not wait on cron.
      if (event.status === "live" && isAuctionClosed(event.date)) {
        await closeEventAuction(event.id);
        event.status = "closed";
      }
      const { data: athlete } = await supabase
        .from("profiles")
        .select("name, social, socials")
        .eq("id", event.athlete_id)
        .maybeSingle();
      athleteName = athlete?.name?.trim() || "Athlete";
      athleteHandle = publicAthleteHandle({
        social: athlete?.social,
        socials: athlete?.socials,
        name: athleteName,
      });

      const admin = createAdminSupabase();
      if (admin) {
        await ensureEventZoneRows(admin, event.id);
      }
      const { data: zoneRows } = await supabase
        .from("zones")
        .select("id, name, status")
        .eq("event_id", event.id);

      const zoneIds = (zoneRows ?? []).map((row) => row.id);
      await holdPaidPendingBids(zoneIds);
      const heldByZone = await loadLeadsByZone(admin ?? supabase, zoneIds);

      const brandIds = [...new Set([...heldByZone.values()].map((item) => item.brand_id))];
      const { data: brands } = brandIds.length
        ? await supabase
            .from("profiles")
            .select("id, name")
            .in("id", brandIds)
        : { data: [] as Array<{ id: string; name: string | null }> };
      const brandMap = new Map((brands ?? []).map((row) => [row.id, row]));
      const rowByName = new Map((zoneRows ?? []).map((row) => [row.name, row]));

      // Always the named zones, even if a row is missing.
      // Pad mark is the held PNG only. Profile logos stay off the body.
      // Outbid drops this URL because that bid is no longer the lead.
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
          logoUrl: held?.logo_url ?? null,
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

  const isOwner = Boolean(user && athleteId && user.id === athleteId);
  const canAdvertise = canAdvertiseOnEvent({
    role: profile?.role ?? null,
    isOwner,
    userId: user?.id ?? null,
    athleteId,
  });

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
        athleteHandle={athleteHandle}
        eventName={eventName}
        eventDate={eventDate}
        glbUrl={glbUrl}
        frontPhotoUrl={bodyPhotos.front}
        backPhotoUrl={bodyPhotos.back}
        zones={zones}
        canBid={brandOnboardingComplete(profile)}
        role={profile?.role ?? null}
        acceptsBids={Boolean(eventId) && slug !== DEMO_SLUG}
        canAdvertise={canAdvertise}
        isOwner={isOwner}
        loginHref={
          user ? onboardingPath("brand", `/e/${slug}`) : loginPath("brand", `/e/${slug}`)
        }
        brandName={profile?.role === "brand" ? profile.name : null}
        currentBrandId={profile?.role === "brand" ? profile.id : null}
        brandLogoUrl={profile?.role === "brand" ? profile.logo_url : null}
        zoneBids={zoneBids}
      />
    </ProductShell>
  );
}
