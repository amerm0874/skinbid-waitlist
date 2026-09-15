import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, VIDEO_BUCKET, type AthleteMedia, type AthleteMediaView } from "@/lib/athlete-media-types";

export async function loadAthleteMedia(id: string): Promise<AthleteMedia | null> {
  const db = createAdminSupabase();
  if (!db) return null;
  const { data } = await db.from("athlete_media").select("*").eq("athlete_id", id).maybeSingle();
  return data as AthleteMedia | null;
}
export async function signMedia(path: string | null, video = false) {
  if (!path) return null;
  const db = createAdminSupabase();
  if (!db) return null;
  const { data } = await db.storage.from(video ? VIDEO_BUCKET : MEDIA_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
export async function mediaView(id: string): Promise<AthleteMediaView> {
  const db = createAdminSupabase();
  const result = db ? await db.from("athlete_media").select("*").eq("athlete_id", id).maybeSingle() : null;
  const media = result?.data as AthleteMedia | null;
  const [originalFront, originalBack, video, candidateFront, candidateBack] = await Promise.all([
    signMedia(media?.original_front ?? null), signMedia(media?.original_back ?? null),
    signMedia(media?.video_path ?? null, true), signMedia(media?.candidate_front ?? null), signMedia(media?.candidate_back ?? null),
  ]);
  const timedOut = media?.state === "processing" && Date.now() - Date.parse(media.updated_at) > 360000;
  return { configured: Boolean(result && !result.error), aiEnabled: Boolean(process.env.OPENROUTER_API_KEY), state: timedOut ? "failed" : media?.state ?? "draft", originalFront, originalBack, video, candidateFront, candidateBack, approved: Boolean(media?.approved_front && media?.approved_back), jobId: media?.job_id ?? null, error: timedOut ? "Photo preparation was interrupted. Your originals are safe. Try again." : media?.error ?? null };
}
export async function loadIntroductionVideo(id: string) {
  const media = await loadAthleteMedia(id);
  return media?.video_shared ? signMedia(media.video_path, true) : null;
}
