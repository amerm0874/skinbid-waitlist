import { NextResponse } from "next/server";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/admin";
import { takeToken } from "@/lib/rate-limit";

const SAVE_ERROR = "Could not save. Try again.";

type Body = {
  email?: string;
  event_slug?: string | null;
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Try again." }, { status: 400 });
  }

  if (!takeToken(`brand-lead:${clientKey(request)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Try again later." }, { status: 429 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const eventSlug =
    typeof body.event_slug === "string" && body.event_slug.trim()
      ? body.event_slug.trim()
      : null;

  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a real email." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const supabase = admin ?? createPublicSupabase();
  if (!supabase) {
    return NextResponse.json({ error: SAVE_ERROR }, { status: 500 });
  }

  const { error } = await supabase
    .from("brand_leads")
    .insert({ email, event_slug: eventSlug });

  if (error) {
    const message = error.message || "";
    if (/duplicate|unique/i.test(message)) {
      console.log("Brand lead already on the list", email, eventSlug ?? "no-slug");
      return NextResponse.json({ ok: true });
    }
    console.log("Brand lead insert failed", message);
    return NextResponse.json({ error: SAVE_ERROR }, { status: 500 });
  }

  console.log("Brand lead saved", email, eventSlug ?? "no-slug");
  return NextResponse.json({ ok: true });
}
