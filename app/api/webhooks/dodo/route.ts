import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { refundHeldOnZone } from "@/lib/close-auctions";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

  if (!secret) {
    return NextResponse.json({ error: "Webhook key missing" }, { status: 401 });
  }

  const webhook = new Webhook(secret);
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
  };
  try {
    await webhook.verify(rawBody, headers);
  } catch {
    console.log("Dodo webhook signature failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as {
    type?: string;
    data?: {
      payment_id?: string;
      metadata?: Record<string, string>;
    };
  };

  const type = payload.type;
  const paymentId = payload.data?.payment_id;
  const metadata = payload.data?.metadata ?? {};
  const bidId = metadata.bid_id;
  const zoneId = metadata.zone_id;

  console.log("Dodo webhook", type, paymentId, bidId);

  if (type === "payment.failed" && bidId) {
    const admin = createAdminSupabase();
    if (admin) {
      await admin.from("bids").update({ status: "failed" }).eq("id", bidId);
    }
    return NextResponse.json({ ok: true });
  }

  if (type !== "payment.succeeded") {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminSupabase();
  if (!admin || !bidId) {
    return NextResponse.json({ ok: true, stored: false });
  }

  await admin
    .from("bids")
    .update({
      status: "held",
      dodo_payment_id: paymentId ?? null,
    })
    .eq("id", bidId);

  if (zoneId && !zoneId.startsWith("demo-")) {
    await refundHeldOnZone(zoneId, bidId);
  }

  return NextResponse.json({ ok: true });
}
