import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { DEMO_SLUG } from "@/lib/demo-event";
import { NO_OG_METADATA } from "@/lib/seo";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isZoneName, ZONE_LABEL } from "@/lib/zones";
import { ProductShell } from "@/components/product/ProductShell";
import AdminBoard, {
  type DraftEvent,
  type PendingProof,
  type ProofFile,
} from "./AdminBoard";

export const metadata: Metadata = {
  title: "Admin",
  ...NO_OG_METADATA,
};

export const dynamic = "force-dynamic";

function fileName(path: string) {
  return path.split("/").pop() || path;
}

async function signedProofFiles(
  admin: SupabaseClient,
  paths: string[],
): Promise<ProofFile[]> {
  if (paths.length === 0) {
    return [];
  }
  const { data } = await admin.storage.from("proofs").createSignedUrls(paths, 60 * 60);
  return paths.map((path, index) => {
    const row = data?.find((item) => item.path === path) ?? data?.[index];
    return {
      path,
      name: fileName(path),
      url: row?.error ? null : row?.signedUrl ?? null,
    };
  });
}

async function loadPendingProofs(admin: SupabaseClient): Promise<PendingProof[]> {
  const { data: proofRows } = await admin
    .from("proofs")
    .select("id, event_id, files, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!proofRows?.length) {
    return [];
  }

  const eventIds = [...new Set(proofRows.map((row) => row.event_id))];
  const { data: events } = await admin
    .from("events")
    .select("id, name, athlete_id")
    .in("id", eventIds);
  const eventMap = new Map((events ?? []).map((row) => [row.id, row]));

  const athleteIds = [
    ...new Set((events ?? []).map((row) => row.athlete_id).filter(Boolean)),
  ];
  const { data: athletes } = athleteIds.length
    ? await admin.from("profiles").select("id, name").in("id", athleteIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const athleteMap = new Map((athletes ?? []).map((row) => [row.id, row.name]));

  const { data: zones } = await admin
    .from("zones")
    .select("id, name, event_id")
    .in("event_id", eventIds);
  const zoneIds = (zones ?? []).map((row) => row.id);
  const { data: wonBids } = zoneIds.length
    ? await admin
        .from("bids")
        .select("zone_id")
        .in("zone_id", zoneIds)
        .in("status", ["held", "won"])
    : { data: [] as Array<{ zone_id: string }> };
  const wonZoneIds = new Set((wonBids ?? []).map((row) => row.zone_id));

  const zonesByEvent = new Map<string, string[]>();
  for (const zone of zones ?? []) {
    if (!wonZoneIds.has(zone.id)) {
      continue;
    }
    const label = isZoneName(zone.name) ? ZONE_LABEL[zone.name] : zone.name;
    const list = zonesByEvent.get(zone.event_id) ?? [];
    list.push(label);
    zonesByEvent.set(zone.event_id, list);
  }

  const proofs: PendingProof[] = [];
  for (const proof of proofRows) {
    const event = eventMap.get(proof.event_id);
    const files = Array.isArray(proof.files) ? proof.files.filter(Boolean) : [];
    proofs.push({
      id: proof.id,
      athleteName: event
        ? athleteMap.get(event.athlete_id)?.trim() || "Unnamed athlete"
        : "Unknown athlete",
      eventName: event?.name ?? proof.event_id,
      zones: zonesByEvent.get(proof.event_id) ?? [],
      files: await signedProofFiles(admin, files),
    });
  }
  return proofs;
}

async function loadDraftEvents(admin: SupabaseClient): Promise<DraftEvent[]> {
  const { data: events } = await admin
    .from("events")
    .select("id, name, slug, date, city, sport, athlete_id")
    .eq("status", "draft")
    .order("created_at", { ascending: true });

  const rows = (events ?? []).filter((row) => row.slug !== DEMO_SLUG);
  if (rows.length === 0) {
    return [];
  }

  const athleteIds = [...new Set(rows.map((row) => row.athlete_id).filter(Boolean))];
  const { data: athletes } = athleteIds.length
    ? await admin.from("profiles").select("id, name").in("id", athleteIds)
    : { data: [] as Array<{ id: string; name: string | null }> };
  const athleteMap = new Map((athletes ?? []).map((row) => [row.id, row.name]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    date: row.date,
    city: row.city,
    sport: row.sport,
    athleteName: athleteMap.get(row.athlete_id)?.trim() || "Unnamed athlete",
  }));
}

export default async function AdminPage() {
  const { user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, "/admin");
  if (gate) {
    redirect(gate);
  }
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/events");
  }

  const admin = createAdminSupabase();
  const proofs = admin ? await loadPendingProofs(admin) : [];
  const drafts = admin ? await loadDraftEvents(admin) : [];

  return (
    <ProductShell email={user.email}>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">Admin</h1>
          <p className="page-lead">
            Drafts stay off /events until a real .glb is ready. Proof review does
            not move money.
          </p>
        </div>
        {!admin ? (
          <p className="text-[15px] text-danger" role="alert">
            Service role key missing.
          </p>
        ) : (
          <AdminBoard drafts={drafts} proofs={proofs} />
        )}
      </div>
    </ProductShell>
  );
}
