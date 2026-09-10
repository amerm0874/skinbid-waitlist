import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ProductNav } from "@/components/product/ProductNav";
import ProofForm from "./ProofForm";

export const metadata: Metadata = {
  title: "Proof",
};

export default async function ProofPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await getSessionUser();
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

  return (
    <div className="min-h-full bg-bg">
      <ProductNav email={user.email} />
      <main className="site-wrap py-12">
        <h1 className="display text-[40px]">Proof — {event.name}</h1>
        <p className="mt-2 max-w-md text-[14px] text-muted">
          Face or bib visible. Wrong day or wrong zone is a reject. Brand is
          refunded if we reject.
        </p>
        <div className="mt-8">
          <ProofForm eventId={event.id} userId={user.id} />
        </div>
      </main>
    </div>
  );
}
