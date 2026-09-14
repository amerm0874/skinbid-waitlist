import { isAuctionClosed } from "@/lib/auction";
import { closeEventAuction } from "@/lib/close-auctions";
import { holdPaidPendingBids } from "@/lib/hold-bid";
import { isMissingColumn } from "@/lib/db-error";
import { DEMO_EVENT, DEMO_SLUG } from "@/lib/demo-event";
import { isReadyAvatar } from "@/lib/event-create";
import {
  demoLogoStoragePath,
  LOGOS_BUCKET,
  parseMarkOffer,
  type MarkKind,
} from "@/lib/logo";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isPublishedEventStatus } from "@/lib/types";
import { isPersistedZoneId, loadLeadsByZone } from "@/lib/zone-bids";
import { ZONE_LABEL, ZONE_NAMES, isZoneName, type ZoneName } from "@/lib/zones";
import type { createServerSupabase } from "@/lib/supabase/server";

export type WinnerZone = {
  id: string;
  name: ZoneName;
  label: string;
  logoUrl: string | null;
  markKind: MarkKind | null;
  postRules: string;
};

export type LogoDesk = {
  slug: string;
  eventName: string;
  athleteName: string;
  isDemo: boolean;
  auctionOpen: boolean;
  offerTattoo: boolean;
  offerSticker: boolean;
  kinds: MarkKind[];
  zones: WinnerZone[];
};

type Db = NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>;

function publicLogoUrl(path: string, version?: number) {
  const admin = createAdminSupabase();
  if (!admin) {
    return null;
  }
  const url = admin.storage.from(LOGOS_BUCKET).getPublicUrl(path).data.publicUrl;
  return version ? `${url}?v=${version}` : url;
}

// Zone name -> public URL for whatever PNGs are sitting in the demo logos
// folder. Backs both the demo logo desk and the demo card's 3D preview, so
// uploading on one shows up on the other.
export async function loadDemoZoneLogos(): Promise<Map<ZoneName, string>> {
  const admin = createAdminSupabase();
  const files = admin
    ? await admin.storage.from(LOGOS_BUCKET).list("demo", { limit: 24 })
    : { data: [] as Array<{ name: string; updated_at?: string }> };
  const byName = new Map(
    (files.data ?? []).map((file) => [file.name, file.updated_at]),
  );

  const logos = new Map<ZoneName, string>();
  for (const name of ZONE_NAMES) {
    const png = byName.get(`${name}.png`);
    if (!png) {
      continue;
    }
    const url = publicLogoUrl(demoLogoStoragePath(name), Date.parse(png) || Date.now());
    if (url) {
      logos.set(name, url);
    }
  }
  return logos;
}

async function loadDemoDesk(): Promise<LogoDesk> {
  const offer = parseMarkOffer({ offer_tattoo: true, offer_sticker: true });
  const demoLogos = await loadDemoZoneLogos();

  const zones: WinnerZone[] = ZONE_NAMES.map((name) => ({
    id: `demo-${name}`,
    name,
    label: ZONE_LABEL[name],
    logoUrl: demoLogos.get(name) ?? null,
    markKind: null,
    postRules: "",
  }));

  return {
    slug: DEMO_SLUG,
    eventName: DEMO_EVENT.name,
    athleteName: DEMO_EVENT.athlete_name,
    isDemo: true,
    auctionOpen: false,
    offerTattoo: offer.tattoo,
    offerSticker: offer.sticker,
    kinds: offer.kinds,
    zones,
  };
}

export async function loadLogoDesk(input: {
  slug: string;
  supabase: Db | null;
  brandId: string | null;
}): Promise<LogoDesk | null> {
  if (input.slug === DEMO_SLUG) {
    return loadDemoDesk();
  }
  if (!input.supabase) {
    return null;
  }

  let eventQuery = input.supabase
    .from("events")
    .select("id, name, date, slug, athlete_id, status, offer_tattoo, offer_sticker")
    .eq("slug", input.slug)
    .maybeSingle();
  let { data: event, error } = await eventQuery;
  if (error && isMissingColumn(error, "offer_tattoo")) {
    ({ data: event, error } = await input.supabase
      .from("events")
      .select("id, name, date, slug, athlete_id, status")
      .eq("slug", input.slug)
      .maybeSingle());
  }
  if (error || !event || !isPublishedEventStatus(event.status)) {
    return null;
  }

  const { data: avatar } = await input.supabase
    .from("avatars")
    .select("glb_url, ready")
    .eq("athlete_id", event.athlete_id)
    .maybeSingle();
  if (!isReadyAvatar(avatar)) {
    return null;
  }

  if (event.status === "live" && isAuctionClosed(event.date)) {
    await closeEventAuction(event.id);
    event.status = "closed";
  }

  const { data: athlete } = await input.supabase
    .from("profiles")
    .select("name")
    .eq("id", event.athlete_id)
    .maybeSingle();

  const { data: zoneRows } = await input.supabase
    .from("zones")
    .select("id, name")
    .eq("event_id", event.id);
  const zoneById = new Map(
    (zoneRows ?? [])
      .filter((row): row is { id: string; name: ZoneName } => isZoneName(row.name))
      .map((row) => [row.id, row]),
  );
  const zoneIds = [...zoneById.keys()].filter(isPersistedZoneId);
  await holdPaidPendingBids(zoneIds);
  const leads = await loadLeadsByZone(input.supabase, zoneIds);
  const zones: WinnerZone[] = [];
  for (const name of ZONE_NAMES) {
    const row = [...zoneById.values()].find((zone) => zone.name === name);
    if (!row) {
      continue;
    }
    const lead = leads.get(row.id);
    if (!lead || lead.brand_id !== input.brandId) {
      continue;
    }
    zones.push({
      id: row.id,
      name,
      label: ZONE_LABEL[name],
      logoUrl: lead.logo_url,
      markKind: lead.mark_kind,
      postRules: lead.post_rules ?? "",
    });
  }

  return {
    slug: event.slug,
    eventName: event.name,
    athleteName: athlete?.name ?? "Athlete",
    isDemo: false,
    auctionOpen: event.status === "live",
    ...deskOffer(event),
    zones,
  };
}

function deskOffer(event: {
  offer_tattoo?: boolean | null;
  offer_sticker?: boolean | null;
}) {
  const offer = parseMarkOffer(event);
  return {
    offerTattoo: offer.tattoo,
    offerSticker: offer.sticker,
    kinds: offer.kinds,
  };
}
