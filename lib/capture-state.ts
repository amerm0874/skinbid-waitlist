import { isMissingColumn } from "@/lib/db-error";
import type { getSessionUser } from "@/lib/auth";
import { CAPTURES_BUCKET, profileClipPathFrom } from "@/lib/capture";
import { createAdminSupabase } from "@/lib/supabase/admin";

type SessionDb = NonNullable<Awaited<ReturnType<typeof getSessionUser>>["supabase"]>;

export async function loadCaptureState(supabase: SessionDb, athleteId: string) {
  const { data, error } = await supabase
    .from("captures")
    .select("id, status, model_paid")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error && isMissingColumn(error, "model_paid")) {
    const { data: fallback } = await supabase
      .from("captures")
      .select("id, status")
      .eq("athlete_id", athleteId)
      .eq("status", "uploaded")
      .limit(1)
      .maybeSingle();
    return { modelPaid: false, scanUploaded: Boolean(fallback) };
  }
  const rows = data ?? [];
  const modelPaid = rows.some((row) => row.model_paid);
  const scanUploaded = rows.some(
    (row) => row.model_paid && row.status === "uploaded",
  );
  return { modelPaid, scanUploaded };
}

export async function loadAthleteProfileClipUrl(athleteId: string) {
  const urls = await loadAthleteProfileClipUrls([athleteId]);
  return urls.get(athleteId) ?? null;
}

export async function loadAthleteProfileClipUrls(athleteIds: string[]) {
  const unique = [...new Set(athleteIds.filter(Boolean))];
  const urls = new Map<string, string>();
  if (unique.length === 0) {
    return urls;
  }
  await Promise.all(
    unique.map(async (athleteId) => {
      const url = await signAthleteProfileClipUrl(athleteId);
      if (url) {
        urls.set(athleteId, url);
      }
    }),
  );
  return urls;
}

async function signAthleteProfileClipUrl(athleteId: string) {
  const admin = createAdminSupabase();
  if (!admin) {
    return null;
  }
  const { data, error } = await admin
    .from("captures")
    .select("paths, model_paid")
    .eq("athlete_id", athleteId)
    .eq("model_paid", true)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) {
    if (isMissingColumn(error, "model_paid")) {
      return null;
    }
    console.log("Profile clip lookup failed", error.message);
    return null;
  }
  for (const row of data ?? []) {
    const path = profileClipPathFrom(row.paths);
    if (!path) {
      continue;
    }
    const { data: signed, error: signError } = await admin.storage
      .from(CAPTURES_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24);
    if (signError || !signed?.signedUrl) {
      console.log("Profile clip sign failed", signError?.message);
      continue;
    }
    return signed.signedUrl;
  }
  return null;
}
