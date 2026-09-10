import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ProductNav } from "@/components/product/ProductNav";
import AdminBoard from "./AdminBoard";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!isAdminEmail(user.email)) {
    redirect("/events");
  }

  const admin = createAdminSupabase();
  const proofs: Array<{
    id: string;
    event_id: string;
    status: string;
    event_name: string;
  }> = [];
  const bids: Array<{
    id: string;
    amount_cents: number;
    status: string;
    payable: boolean;
    dodo_payment_id: string | null;
    event_name: string;
    zone_name: string;
  }> = [];

  if (admin) {
    const { data: proofRows } = await admin
      .from("proofs")
      .select("id, event_id, status")
      .order("created_at", { ascending: false });
    const eventIds = [...new Set((proofRows ?? []).map((row) => row.event_id))];
    const { data: events } = eventIds.length
      ? await admin.from("events").select("id, name").in("id", eventIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const eventMap = new Map((events ?? []).map((row) => [row.id, row.name]));
    for (const proof of proofRows ?? []) {
      proofs.push({
        ...proof,
        event_name: eventMap.get(proof.event_id) ?? proof.event_id,
      });
    }

    const { data: bidRows } = await admin
      .from("bids")
      .select("id, amount_cents, status, payable, dodo_payment_id, zone_id")
      .in("status", ["held", "won", "pending"])
      .order("created_at", { ascending: false });
    const zoneIds = [...new Set((bidRows ?? []).map((row) => row.zone_id))];
    const { data: zones } = zoneIds.length
      ? await admin.from("zones").select("id, name, event_id").in("id", zoneIds)
      : { data: [] as Array<{ id: string; name: string; event_id: string }> };
    const zoneMap = new Map((zones ?? []).map((row) => [row.id, row]));
    const bidEventIds = [...new Set((zones ?? []).map((row) => row.event_id))];
    const { data: bidEvents } = bidEventIds.length
      ? await admin.from("events").select("id, name").in("id", bidEventIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const bidEventMap = new Map((bidEvents ?? []).map((row) => [row.id, row.name]));
    for (const bid of bidRows ?? []) {
      const zone = zoneMap.get(bid.zone_id);
      bids.push({
        id: bid.id,
        amount_cents: bid.amount_cents,
        status: bid.status,
        payable: bid.payable,
        dodo_payment_id: bid.dodo_payment_id,
        zone_name: zone?.name ?? "zone",
        event_name: zone ? (bidEventMap.get(zone.event_id) ?? "") : "",
      });
    }
  }

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user.email} />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">Admin</h1>
        <p className="mt-2 text-[14px] text-muted">
          Approve writes the 80/20 ledger and marks payable. Reject refunds the
          brand through Dodo.
        </p>
        <div className="mt-10">
          <AdminBoard proofs={proofs} bids={bids} />
        </div>
      </main>
    </div>
  );
}
