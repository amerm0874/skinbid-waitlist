import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { appendLocalWaitlist } from "@/lib/waitlist-local";
import { hasPublicSupabase } from "@/lib/supabase/client";
import {
  WAITLIST_RATE_LIMIT,
  WAITLIST_RATE_WINDOW_MS,
  type Role,
} from "@/lib/config";
import { takeToken } from "@/lib/rate-limit";

type Body = {
  name?: string;
  email?: string;
  social?: string;
  company?: string;
  from?: string;
  fields?: Record<string, string>;
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
  const body = (await request.json()) as Body;

  if (!takeToken(clientKey(request), WAITLIST_RATE_LIMIT, WAITLIST_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Try again later." }, { status: 429 });
  }

  // Bots fill the hidden "company" box. Pretend it worked so they leave.
  if ((body.company ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? body.fields?.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const social = (body.social ?? body.fields?.social ?? "").trim();
  const from: Role | undefined =
    body.from === "brand" || body.fields?.from === "brand"
      ? "brand"
      : body.from === "athlete" || body.fields?.from === "athlete"
        ? "athlete"
        : undefined;
  const fields: Record<string, string> = {
    ...(body.fields ?? {}),
    name,
    social,
  };
  if (from) {
    fields.from = from;
  }

  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }
  if (!isEmail(email)) {
    return NextResponse.json({ error: "Enter a real email." }, { status: 400 });
  }
  if (!social) {
    return NextResponse.json({ error: "Enter Instagram or X." }, { status: 400 });
  }

  const row = {
    email,
    name,
    social,
    fields,
    ...(from ? { role: from } : {}),
  };

  if (hasPublicSupabase()) {
    const admin = createAdminSupabase();
    const supabase = admin ?? (await createServerSupabase());
    if (supabase) {
      const attempts = [
        row,
        { email, name, social, fields },
        { email, fields, ...(from ? { role: from } : {}) },
        { email, fields },
      ];
      for (const attempt of attempts) {
        const { error } = await supabase.from("waitlist").insert(attempt);
        if (!error) {
          console.log("Waitlist saved to Supabase");
          return NextResponse.json({ ok: true, stored: "supabase" });
        }
        console.log("Waitlist insert failed", error.message);
      }
    }
  }

  // On Vercel the disk is thrown away. Do not fake a save there.
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: "Could not save. Try again." },
      { status: 500 },
    );
  }

  try {
    await appendLocalWaitlist({ email, name, social, fields });
    return NextResponse.json({ ok: true, stored: "local" });
  } catch {
    return NextResponse.json(
      { error: "Could not save. Try again." },
      { status: 500 },
    );
  }
}
