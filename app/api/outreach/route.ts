import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSessionUser } from "@/lib/auth";
import { SITE } from "@/lib/config";

type Body = {
  brand_id?: string;
  event_name?: string;
};

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || profile?.role !== "athlete") {
    return NextResponse.json({ error: "Athletes send outreach." }, { status: 403 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const body = (await request.json()) as Body;
  const { data: brand } = await supabase
    .from("profiles")
    .select("name, website, brand_category")
    .eq("id", body.brand_id ?? "")
    .eq("role", "brand")
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("name, date, city, sport, slug")
    .eq("athlete_id", user.id)
    .eq("status", "live")
    .maybeSingle();

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("Outreach skipped — no RESEND_API_KEY", brand.name);
    return NextResponse.json({
      ok: true,
      stored: "log",
    });
  }

  const resend = new Resend(key);
  const from = process.env.RESEND_FROM ?? "SkinBid <skinbidme@gmail.com>";
  const eventLine = event
    ? `${event.name} · ${event.city ?? ""} · ${event.date}`
    : body.event_name || "an upcoming event";

  const { error } = await resend.emails.send({
    from,
    to: SITE.email,
    subject: `Athlete outreach: ${profile.name ?? "Athlete"} × ${brand.name ?? "brand"}`,
    text: [
      `${profile.name ?? "An athlete"} asked SkinBid to reach ${brand.name ?? "a brand"}.`,
      `Event: ${eventLine}`,
      `Athlete social: ${profile.social ?? "—"}`,
      `Brand site: ${brand.website ?? "—"}`,
      `Category: ${brand.brand_category ?? "—"}`,
      event ? `Page: ${SITE.url}/e/${event.slug}` : "",
      "Reply to SkinBid. Do not open an in-app thread.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    console.log("Resend failed", error);
    return NextResponse.json({ error: "Email did not send." }, { status: 500 });
  }

  console.log("Outreach email sent from SkinBid");
  return NextResponse.json({ ok: true });
}
