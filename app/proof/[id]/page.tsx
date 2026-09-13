import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { sessionGateRedirect } from "@/lib/config";
import { NO_OG_METADATA } from "@/lib/seo";
import { ProductShell } from "@/components/product/ProductShell";
import ProofForm from "./ProofForm";

export const metadata: Metadata = {
  title: "Proof",
  ...NO_OG_METADATA,
};

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, `/proof/${id}`);
  if (gate) {
    redirect(gate);
  }
  if (!user) {
    redirect("/login");
  }
  if (!supabase) {
    notFound();
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, name, athlete_id")
    .eq("id", id)
    .maybeSingle();

  if (!event || event.athlete_id !== user.id) {
    notFound();
  }

  const { data: proof } = await supabase
    .from("proofs")
    .select("status")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = proof?.status;
  const existing =
    status === "pending" || status === "approved" || status === "rejected"
      ? { status }
      : null;

  return (
    <ProductShell email={user.email}>
      <div className="page-stack">
        <h1 className="slot-board-kicker">Proof</h1>
        <ProofForm
          eventId={event.id}
          eventName={event.name}
          userId={user.id}
          existing={existing}
        />
      </div>
    </ProductShell>
  );
}
