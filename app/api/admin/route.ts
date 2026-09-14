import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { notifyProofReviewed, notifyRefundDone } from "@/lib/email";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Body = {
  action?: "approve" | "reject";
  proof_id?: string;
};

export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Service role key missing." }, { status: 503 });
  }

  const body = (await request.json()) as Body;
  if (!body.proof_id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "Need a proof and an action." }, { status: 400 });
  }

  const { data: proof } = await admin
    .from("proofs")
    .select("id, event_id, status")
    .eq("id", body.proof_id)
    .maybeSingle();
  if (!proof) {
    return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  }
  if (proof.status !== "pending") {
    return NextResponse.json({ error: "Proof is not pending." }, { status: 409 });
  }

  const { data: event } = await admin
    .from("events")
    .select("athlete_id, name, slug")
    .eq("id", proof.event_id)
    .maybeSingle();

  if (body.action === "approve") {
    // Won bids stay won. Do not write the ledger or move money.
    const { error } = await admin
      .from("proofs")
      .update({ status: "approved" })
      .eq("id", proof.id)
      .eq("status", "pending");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (event) {
      await notifyProofReviewed({
        proofId: proof.id,
        athleteId: event.athlete_id,
        eventId: proof.event_id,
        eventName: event.name,
        eventSlug: event.slug,
        approved: true,
      });
    }
    console.log("Proof approved", proof.id);
    return NextResponse.json({ ok: true });
  }

  const { data: zones } = await admin
    .from("zones")
    .select("id, name")
    .eq("event_id", proof.event_id);
  const zoneIds = (zones ?? []).map((row) => row.id);
  const zoneName = new Map((zones ?? []).map((row) => [row.id, row.name]));
  const { data: refundBids } = zoneIds.length
    ? await admin
        .from("bids")
        .select("id, brand_id, amount_cents, zone_id")
        .in("zone_id", zoneIds)
        .in("status", ["held", "won"])
    : { data: [] as Array<{
        id: string;
        brand_id: string;
        amount_cents: number;
        zone_id: string;
      }> };
  if (zoneIds.length > 0) {
    const { error: bidError } = await admin
      .from("bids")
      .update({ status: "refunded", payable: false })
      .in("zone_id", zoneIds)
      .in("status", ["held", "won"]);
    if (bidError) {
      return NextResponse.json({ error: bidError.message }, { status: 500 });
    }
  }

  const { error: proofError } = await admin
    .from("proofs")
    .update({ status: "rejected" })
    .eq("id", proof.id)
    .eq("status", "pending");
  if (proofError) {
    return NextResponse.json({ error: proofError.message }, { status: 500 });
  }

  if (event) {
    await notifyProofReviewed({
      proofId: proof.id,
      athleteId: event.athlete_id,
      eventId: proof.event_id,
      eventName: event.name,
      eventSlug: event.slug,
      approved: false,
    });
    if (event.slug) {
      for (const bid of refundBids ?? []) {
        await notifyRefundDone({
          bidId: bid.id,
          brandId: bid.brand_id,
          zoneName: zoneName.get(bid.zone_id) ?? "zone",
          amountCents: bid.amount_cents,
          eventSlug: event.slug,
        });
      }
    }
  }
  console.log("Proof rejected, bids marked refunded. No payout call.");
  return NextResponse.json({ ok: true });
}
