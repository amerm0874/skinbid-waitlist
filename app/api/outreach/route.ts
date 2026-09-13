import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SITE } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { takeToken } from "@/lib/rate-limit";

type Body = {
  brand_id?: string;
  event_name?: string;
};

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || profile?.role !== "athlete") {
    return NextResponse.json({ error: "Athletes send outreach." }, { status: 403 });
  }
  if (!takeToken(`outreach:${user.id}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many messages. Wait a minute." }, { status: 429 });
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

  const eventLine = event
    ? `${event.name} · ${event.city ?? ""} · ${event.date}`
    : body.event_name || "an upcoming event";
  const pageLine = event ? `Page: ${SITE.url}/e/${event.slug}` : "";
  const text = [
    `${profile.name ?? "An athlete"} asked SkinBid to reach ${brand.name ?? "a brand"}.`,
    `Event: ${eventLine}`,
    `Athlete social: ${profile.social ?? "—"}`,
    `Brand site: ${brand.website ?? "—"}`,
    `Category: ${brand.brand_category ?? "—"}`,
    pageLine,
    "Reply to SkinBid. Do not open an in-app thread.",
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<body>
${text
  .split("\n")
  .map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</p>`)
  .join("\n")}
</body>
</html>`;

  const entityId = `${user.id}:${body.brand_id}:${event?.slug ?? body.event_name ?? "none"}`;
  const result = await sendEmail("outreach", entityId, {
    to: SITE.email,
    subject: `Athlete outreach: ${profile.name ?? "Athlete"} × ${brand.name ?? "brand"}`,
    text,
    html,
  });

  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json({
      ok: true,
      stored: "log",
    });
  }
  if (result.error) {
    return NextResponse.json({ error: "Email did not send." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
