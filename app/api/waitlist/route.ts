import { NextResponse } from "next/server";
import { createAdminSupabase, createPublicSupabase } from "@/lib/supabase/admin";
import { appendLocalWaitlist } from "@/lib/waitlist-local";
import {
  WAITLIST_RATE_LIMIT,
  WAITLIST_RATE_WINDOW_MS,
  type Role,
} from "@/lib/config";
import { takeToken } from "@/lib/rate-limit";

const SAVE_ERROR = "Could not save. Try again.";

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

function saveFailed() {
  return NextResponse.json({ error: SAVE_ERROR }, { status: 500 });
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Try again." }, { status: 400 });
  }

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

  if (!from) {
    return NextResponse.json({ error: "Choose athlete or brand." }, { status: 400 });
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

  const fields: Record<string, string> = {
    ...(body.fields ?? {}),
    name,
    social,
    from,
  };

  const supabase = createAdminSupabase() ?? createPublicSupabase();
  if (supabase) {
    try {
      const { data: existing, error: findError } = await supabase
        .from("waitlist")
        .select("id")
        .eq("email", email)
        .limit(1);
      if (!findError && existing && existing.length > 0) {
        console.log("Waitlist email already stored");
        return NextResponse.json({ ok: true, stored: "supabase" });
      }

      // Live table uses instagram + required role. Keep older column names as backups.
      const attempts: Record<string, unknown>[] = [
        { email, name, instagram: social, role: from, fields },
        { email, name, social, role: from, fields },
        { email, role: from, fields },
        { email, role: from, extra: social },
        { email, role: from },
      ];
      for (const attempt of attempts) {
        const { error } = await supabase.from("waitlist").insert(attempt);
        if (!error) {
          console.log("Waitlist saved to Supabase");
          return NextResponse.json({ ok: true, stored: "supabase" });
        }
        const message = error.message || "";
        console.log("Waitlist insert failed", message);
        if (/duplicate|unique/i.test(message)) {
          return NextResponse.json({ ok: true, stored: "supabase" });
        }
      }
    } catch (error) {
      console.log("Waitlist supabase threw", error);
    }
  } else {
    console.log("Waitlist missing supabase client");
  }

  if (process.env.VERCEL) {
    return saveFailed();
  }

  try {
    await appendLocalWaitlist({ email, name, social, fields });
    return NextResponse.json({ ok: true, stored: "local" });
  } catch (error) {
    console.log("Waitlist local save failed", error);
    return saveFailed();
  }
}
