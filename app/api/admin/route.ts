import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { refundDodoPayment } from "@/lib/dodo";
import { ATHLETE_SHARE, PLATFORM_SHARE } from "@/lib/config";

type Body = {
  action?: "approve" | "reject" | "refund" | "payable";
  proof_id?: string;
  bid_id?: string;
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

  if (body.action === "refund" && body.bid_id) {
    const { data: bid } = await admin
      .from("bids")
      .select("id, dodo_payment_id, status")
      .eq("id", body.bid_id)
      .maybeSingle();
    if (!bid?.dodo_payment_id) {
      return NextResponse.json({ error: "No Dodo payment on this bid." }, { status: 400 });
    }
    await refundDodoPayment(bid.dodo_payment_id, "Admin refund");
    await admin.from("bids").update({ status: "refunded", payable: false }).eq("id", bid.id);
    console.log("Admin refunded bid", bid.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "payable" && body.bid_id) {
    await admin.from("bids").update({ payable: true }).eq("id", body.bid_id);
    console.log("Admin marked payable", body.bid_id);
    return NextResponse.json({ ok: true });
  }

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

  const { data: zones } = await admin
    .from("zones")
    .select("id")
    .eq("event_id", proof.event_id);
  const zoneIds = (zones ?? []).map((row) => row.id);
  const { data: won } = await admin
    .from("bids")
    .select("id, amount_cents, dodo_payment_id")
    .in("zone_id", zoneIds)
    .eq("status", "won");

  if (body.action === "reject") {
    for (const bid of won ?? []) {
      if (bid.dodo_payment_id) {
        await refundDodoPayment(bid.dodo_payment_id, "Proof rejected");
      }
      await admin.from("bids").update({ status: "refunded", payable: false }).eq("id", bid.id);
    }
    await admin.from("proofs").update({ status: "rejected" }).eq("id", proof.id);
    await admin.from("events").update({ status: "done" }).eq("id", proof.event_id);
    console.log("Proof rejected, brands refunded");
    return NextResponse.json({ ok: true });
  }

  for (const bid of won ?? []) {
    const athleteCents = Math.round(bid.amount_cents * ATHLETE_SHARE);
    const platformCents = Math.round(bid.amount_cents * PLATFORM_SHARE);
    await admin.from("ledger").insert({
      proof_id: proof.id,
      bid_id: bid.id,
      athlete_cents: athleteCents,
      platform_cents: platformCents,
    });
    await admin.from("bids").update({ payable: true }).eq("id", bid.id);
  }
  await admin.from("proofs").update({ status: "approved" }).eq("id", proof.id);
  await admin.from("events").update({ status: "done" }).eq("id", proof.event_id);
  console.log("Proof approved, 80/20 ledger written");
  return NextResponse.json({ ok: true });
}
