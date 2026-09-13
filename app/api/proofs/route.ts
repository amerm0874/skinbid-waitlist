import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { notifyProofSubmitted } from "@/lib/email";

type Body = {
  event_id?: string;
  files?: string[];
  post_url?: string | null;
};

const PROOF_SLOT = /^(zone-1|zone-2|venue)\.(jpe?g|png|webp)$/i;

function ownProofPaths(userId: string, eventId: string, files: string[]) {
  const prefix = `${userId}/${eventId}/`;
  const slots = new Set<string>();
  for (const path of files) {
    if (
      path.includes("..") ||
      path.includes("\\") ||
      path.includes("\0") ||
      !path.startsWith(prefix)
    ) {
      return false;
    }
    const rest = path.slice(prefix.length);
    const slot = rest.split(".")[0]?.toLowerCase();
    if (!rest || rest.includes("/") || !PROOF_SLOT.test(rest) || !slot) {
      return false;
    }
    if (slots.has(slot)) {
      return false;
    }
    slots.add(slot);
  }
  return slots.size === 3 && slots.has("zone-1") && slots.has("zone-2") && slots.has("venue");
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!user || profile?.role !== "athlete") {
    return NextResponse.json({ error: "Athletes submit proof." }, { status: 403 });
  }
  if (!supabase) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad proof payload." }, { status: 400 });
  }

  const eventId = body.event_id?.trim() ?? "";
  const files = (body.files ?? []).filter((path) => typeof path === "string" && path);
  if (!eventId || files.length !== 3) {
    return NextResponse.json(
      { error: "Upload 2 zone photos and 1 venue photo." },
      { status: 400 },
    );
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, name, athlete_id")
    .eq("id", eventId)
    .eq("athlete_id", user.id)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!ownProofPaths(user.id, event.id, files)) {
    return NextResponse.json({ error: "Upload your own proof photos." }, { status: 400 });
  }

  const row = {
    event_id: event.id,
    files,
    post_url: body.post_url || null,
    status: "pending" as const,
  };
  let inserted = await supabase.from("proofs").insert(row).select("id").single();
  if (inserted.error && /post_url|schema cache|column/i.test(inserted.error.message)) {
    inserted = await supabase
      .from("proofs")
      .insert({
        event_id: event.id,
        files,
        status: "pending",
      })
      .select("id")
      .single();
  }
  if (inserted.error || !inserted.data) {
    console.log("Proof insert failed", inserted.error?.message);
    return NextResponse.json({ error: "Could not save proof." }, { status: 500 });
  }

  await notifyProofSubmitted({
    proofId: inserted.data.id,
    eventName: event.name,
    athleteName: profile.name,
  });

  console.log("Proof uploaded", event.id);
  return NextResponse.json({ ok: true, proof_id: inserted.data.id });
}
