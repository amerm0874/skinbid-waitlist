import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { athleteIsAdult, athleteSportComplete } from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { mediaView, loadAthleteMedia } from "@/lib/athlete-media";
import { MEDIA_BUCKET, VIDEO_BUCKET, type AthleteMedia, type MediaKind } from "@/lib/athlete-media-types";
import { isJpegBytes, isPngBytes } from "@/lib/photo";
import { PHOTO_MODEL, prepareAthletePhotos } from "@/lib/prepare-athlete-photos";
import { takeToken } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function access() {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: json({ error: "Log in to manage your photos." }, 401) };
  if (profile?.role !== "athlete" || !athleteIsAdult(profile) || !athleteSportComplete(profile)) return { error: json({ error: "Complete your athlete profile first. You must be 18 or older." }, 403) };
  const db = createAdminSupabase();
  if (!db) return { error: json({ error: "Media storage is not configured yet." }, 503) };
  return { user, db };
}
export async function GET() {
  const auth = await access();
  if (auth.error) return auth.error;
  return json(await mediaView(auth.user.id));
}
export async function POST(request: Request) {
  const auth = await access();
  if (auth.error) return auth.error;
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Open this page on Skinbid and try again." }, 403);
  if (!takeToken(`athlete-media:${auth.user.id}`, 30, 600000)) return json({ error: "Too many requests. Wait a few minutes." }, 429);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid media request." }, 400);
  const { db, user } = auth;
  const { error: setupError } = await db.from("athlete_media").upsert({ athlete_id: user.id }, { onConflict: "athlete_id", ignoreDuplicates: true });
  if (setupError) return json({ error: "Photo setup is not available yet. Please contact Skinbid." }, 503);
  const media = await loadAthleteMedia(user.id);
  if (!media) return json({ error: "Could not load your photo setup. Refresh and try again." }, 503);

  if (body.action === "generate") {
    if (body.consent !== true) return json({ error: "Confirm that these are your photos and agree to AI processing." }, 400);
    if (!process.env.OPENROUTER_API_KEY) return json({ error: "AI photo preparation is not enabled yet. Your uploads are saved." }, 503);
    const { data, error } = await db.rpc("claim_athlete_media", { p_athlete_id: user.id, p_job_id: randomUUID(), p_model: PHOTO_MODEL });
    if (error) return json({ error: error.code === "P0001" ? error.message : "Could not start photo preparation. Please try again." }, 409);
    const claimed = (Array.isArray(data) ? data[0] : data) as AthleteMedia;
    if (!claimed?.job_id) return json({ error: "Could not create a photo preparation record." }, 500);
    after(() => prepareAthletePhotos(claimed));
    return json({ ok: true, jobId: claimed.job_id }, 202);
  }
  if (body.action === "approve") {
    if (body.consent !== true || body.jobId !== media.job_id) return json({ error: "Review these photos and confirm that they still look like you." }, 400);
    const { error } = await db.rpc("approve_athlete_media", { p_athlete_id: user.id, p_job_id: media.job_id });
    if (error) return json({ error: error.code === "P0001" ? error.message : "Could not approve your photos. Please try again." }, 409);
    revalidatePath("/me"); revalidatePath("/new"); revalidatePath("/athletes");
    revalidatePath("/a/[handle]", "page"); revalidatePath("/e/[slug]", "page");
    return json({ ok: true });
  }
  if (body.action === "remove-video") {
    const { error } = await db.from("athlete_media").update({ video_shared: false, updated_at: new Date().toISOString() }).eq("athlete_id", user.id).eq("updated_at", media.updated_at).select("athlete_id").single();
    if (error) return json({ error: "Could not hide the video. Refresh and try again." }, 409);
    revalidatePath("/a/[handle]", "page");
    return json({ ok: true });
  }
  if (media.state === "processing" && Date.now() - Date.parse(media.updated_at) < 360000) return json({ error: "Wait for your photos to finish before changing uploads." }, 409);
  const kind: MediaKind = body.kind;
  if (!["front", "back", "video"].includes(kind)) return json({ error: "Choose a front photo, back photo or video." }, 400);
  const video = kind === "video", bucket = video ? VIDEO_BUCKET : MEDIA_BUCKET;
  if (body.action === "upload") {
    const allowed = video ? ["video/mp4", "video/webm"] : ["image/jpeg", "image/png"];
    const max = (video ? 40 : 8) * 1024 * 1024;
    if (!allowed.includes(body.type) || !Number.isFinite(body.size) || body.size < 32 || body.size > max) return json({ error: video ? "Use an MP4 or WebM video under 40 MB." : "Use a JPG or PNG photo under 8 MB." }, 400);
    if (body.consent !== true) return json({ error: "Confirm you own this media and agree to share the introduction video." }, 400);
    const ext = body.type === "image/png" ? "png" : body.type === "video/mp4" ? "mp4" : video ? "webm" : "jpg";
    const path = `${user.id}/original/${kind}-${randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) return json({ error: "Could not start the upload. Please try again." }, 503);
    return json({ path, token: data.token, bucket });
  }
  if (body.action === "complete") {
    if (body.consent !== true) return json({ error: "Confirm your upload consent." }, 400);
    const path = typeof body.path === "string" ? body.path : "";
    const suffix = path.slice(`${user.id}/original/`.length);
    if (!path.startsWith(`${user.id}/original/`) || !new RegExp(`^${kind}-[a-f0-9-]{36}\\.${video ? "(mp4|webm)" : "(jpg|png)"}$`).test(suffix)) return json({ error: "Invalid upload path." }, 400);
    const { data: file, error: downloadError } = await db.storage.from(bucket).download(path);
    if (downloadError || !file || file.size > (video ? 40 : 8) * 1024 * 1024) return json({ error: "The upload did not finish. Choose the file and try again." }, 400);
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mp4 = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
    const webm = [0x1a,0x45,0xdf,0xa3].every((value, index) => bytes[index] === value);
    if (video ? !(mp4 || webm) : !(isJpegBytes(bytes) || isPngBytes(bytes))) return json({ error: "That file is not a supported photo or video." }, 400);
    const values = video ? { video_path: path, video_shared: true } : { [kind === "front" ? "original_front" : "original_back"]: path, state: "draft", candidate_front: null, candidate_back: null, job_id: null, error: null };
    const { error } = await db.from("athlete_media").update({ ...values, updated_at: new Date().toISOString() }).eq("athlete_id", user.id).eq("updated_at", media.updated_at).select("athlete_id").single();
    if (error) return json({ error: "Your setup changed in another tab. Refresh and try again." }, 409);
    revalidatePath("/me"); revalidatePath("/a/[handle]", "page");
    return json({ ok: true });
  }
  return json({ error: "Unknown media action." }, 400);
}
