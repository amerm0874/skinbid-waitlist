import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  hp?: string;
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

function saved() {
  return NextResponse.json({ ok: true, stored: "supabase" });
}

async function findWaitlistId(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from("waitlist")
    .select("id")
    .eq("email", email)
    .limit(1);
  if (error) {
    console.log("Waitlist lookup failed", error.message);
    return null;
  }
  return data?.[0]?.id ?? null;
}

async function writeWaitlist(
  supabase: SupabaseClient,
  row: {
    email: string;
    name: string;
    social: string;
    from: Role;
    fields: Record<string, string>;
  },
) {
  const existingId = await findWaitlistId(supabase, row.email);
  const updates: Record<string, unknown>[] = [
    {
      name: row.name,
      instagram: row.social,
      role: row.from,
      fields: row.fields,
    },
    {
      name: row.name,
      social: row.social,
      role: row.from,
      fields: row.fields,
    },
  ];

  if (existingId) {
    for (const update of updates) {
      const { error } = await supabase
        .from("waitlist")
        .update(update)
        .eq("id", existingId);
      if (!error) {
        console.log("Waitlist updated in Supabase");
        return true;
      }
      console.log("Waitlist update failed", error.message);
    }
    return true;
  }

  const inserts: Record<string, unknown>[] = [
    {
      email: row.email,
      name: row.name,
      instagram: row.social,
      role: row.from,
      fields: row.fields,
    },
    {
      email: row.email,
      name: row.name,
      social: row.social,
      role: row.from,
      fields: row.fields,
    },
    { email: row.email, role: row.from, fields: row.fields },
    { email: row.email, role: row.from, extra: row.social },
    { email: row.email, role: row.from },
  ];

  for (const attempt of inserts) {
    const { error } = await supabase.from("waitlist").insert(attempt);
    if (!error) {
      console.log("Waitlist saved to Supabase");
      return true;
    }
    const message = error.message || "";
    console.log("Waitlist insert failed", message);
    if (/duplicate|unique/i.test(message)) {
      return true;
    }
  }

  return false;
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

  // Bots fill the hidden trap box. Pretend it worked so they leave.
  if ((body.hp ?? body.company ?? "").trim()) {
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

  const admin = createAdminSupabase();
  const supabase = admin ?? createPublicSupabase();
  console.log("Waitlist client", admin ? "admin" : supabase ? "public" : "none");

  if (supabase) {
    try {
      const wrote = await writeWaitlist(supabase, {
        email,
        name,
        social,
        from,
        fields,
      });
      if (wrote) {
        if (admin) {
          const storedId = await findWaitlistId(admin, email);
          if (!storedId) {
            console.log("Waitlist write reported ok but row is missing");
            return saveFailed();
          }
        }
        return saved();
      }
    } catch (error) {
      console.log("Waitlist supabase threw", error);
    }
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
