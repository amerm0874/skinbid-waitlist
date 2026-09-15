import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { signMedia } from "@/lib/athlete-media";

// Durable, owner-only lookup for each preparation, including partial results.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user } = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const db = createAdminSupabase();
  if (!db) return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  const { data: job, error } = await db.from("athlete_media_jobs").select("id,model,prompt_version,status,output_front,output_back,usage_front,usage_back,error,created_at,finished_at").eq("id", id).eq("athlete_id", user.id).maybeSingle();
  if (error || !job) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [front, back] = await Promise.all([signMedia(job.output_front), signMedia(job.output_back)]);
  return NextResponse.json({ ...job, output_front: front, output_back: back }, { headers: { "Cache-Control": "private, no-store" } });
}
