import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { findBid, holdPaidBid } from "@/lib/hold-bid";
import {
  athleteIdFromMetadata,
  bidIdFromMetadata,
  captureIdFromMetadata,
  isAthleteModelPayment,
  kindFromMetadata,
  parseWhopWebhook,
  WebhookVerificationError,
} from "@/lib/whop";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = parseWhopWebhook(rawBody, request);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.log("Whop webhook signature failed", error.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    throw error;
  }

  const metadata = event.data?.metadata ?? null;
  console.log("Whop webhook", event.type, kindFromMetadata(metadata) ?? "no-kind");
  const athleteModel = isAthleteModelPayment(metadata);

  if (event.type === "payment.failed") {
    if (athleteModel) {
      return NextResponse.json({ ok: true });
    }
    const bidId = bidIdFromMetadata(metadata);
    await failPendingBid({ bidId, checkoutId: event.data?.checkout_configuration_id ?? null });
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "payment.succeeded") {
    return NextResponse.json({ ok: true });
  }

  const payment = event.data;
  const paymentId = payment?.id ?? null;
  if (!paymentId) {
    return NextResponse.json({ ok: true, held: false });
  }

  if (athleteModel) {
    const modelPaid = await markAthleteModelPaid({
      captureId: captureIdFromMetadata(metadata),
      athleteId: athleteIdFromMetadata(metadata),
      paymentId,
    });
    return NextResponse.json({ ok: true, model_paid: modelPaid });
  }

  const bidId = bidIdFromMetadata(metadata);
  const checkoutId = payment?.checkout_configuration_id ?? null;
  const held = await holdPaidBid({
    bidId,
    checkoutId,
    paymentId,
    paidCents: Math.round(Number(payment?.total?.amount ?? "0") * 100),
  });

  return NextResponse.json({ ok: true, held });
}

async function markAthleteModelPaid(input: {
  captureId: string | null;
  athleteId: string | null;
  paymentId: string;
}) {
  const admin = createAdminSupabase();
  if (!admin) {
    return false;
  }
  if (!input.captureId) {
    console.log("Whop athlete_model — no capture_id", input.paymentId);
    return false;
  }

  const { data: capture } = await admin
    .from("captures")
    .select("id, athlete_id, model_paid")
    .eq("id", input.captureId)
    .maybeSingle();
  if (!capture) {
    console.log("Whop athlete_model — no capture", input.paymentId, input.captureId);
    return false;
  }
  if (input.athleteId && capture.athlete_id !== input.athleteId) {
    console.log("Whop athlete_model — athlete mismatch", input.paymentId, input.captureId);
    return false;
  }
  if (capture.model_paid) {
    return true;
  }

  const { error } = await admin
    .from("captures")
    .update({
      model_paid: true,
      whop_payment_id: input.paymentId,
    })
    .eq("id", capture.id);
  if (error) {
    console.log("Whop athlete_model update failed", capture.id, error.message);
    return false;
  }
  revalidatePath("/new");
  console.log("Whop athlete model paid", capture.id, input.paymentId);
  return true;
}

async function failPendingBid(input: { bidId?: string | null; checkoutId?: string | null }) {
  const admin = createAdminSupabase();
  if (!admin) {
    return;
  }
  const bid = await findBid(admin, input);
  if (!bid || bid.status !== "pending") {
    return;
  }
  await admin.from("bids").update({ status: "failed" }).eq("id", bid.id);
}

