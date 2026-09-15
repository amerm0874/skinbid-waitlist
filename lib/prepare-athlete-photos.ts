import "server-only";
import sharp from "sharp";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { MEDIA_BUCKET, type AthleteMedia } from "@/lib/athlete-media-types";

export const PHOTO_MODEL = "google/gemini-3.1-flash-image";
// Versioned with the job record. This is an edit, never a body/identity redesign.
export function athletePhotoPrompt(side: "front" | "back") {
  return `Skinbid studio specification v2. Edit the FIRST reference: the ${side}-view photograph of an adult athlete. The SECOND is the same athlete from the opposite side, for identity consistency only. If a THIRD reference is supplied, it is their approved-format front rendering: match its backdrop, lighting, body scale and floor line, NOT its front orientation. Keep exactly the real person's identity, face, skin tone, physique, proportions, tattoos, clothing, pose and ${side} orientation from the FIRST image. Do not beautify, add muscle, change body fat, remove clothing, invent anatomy, logos, markings, rectangles, text or sponsors. Use the same seamless matte charcoal backdrop (#242629), soft balanced neutral 5500K studio lighting, realistic skin texture, eye-level straight-on camera and natural 85mm portrait perspective for every athlete. One full-body photograph, 2:3 portrait. Center the subject at 50% width, aim for top of head at 8% and soles at 92% height, leaving arms fully inside frame. Preserve proportions; never stretch or crop the body to fit. Do not invent body parts missing from the source. No props, visible lighting equipment, gradients or collages. Identity preservation takes priority over framing. The result must be recognizable as this exact athlete, not a generic model.`;
}

export async function prepareAthletePhotos(media: AthleteMedia) {
  const db = createAdminSupabase();
  const key = process.env.OPENROUTER_API_KEY;
  if (!db || !key || !media.job_id) return;
  const jobId = media.job_id;
  try {
    const inputs = await Promise.all((["front", "back"] as const).map(async (side) => {
      const source = side === "front" ? media.original_front : media.original_back;
      if (!source) throw new Error("Both original photos are required.");
      const { data: input, error: downloadError } = await db.storage.from(MEDIA_BUCKET).download(source);
      if (downloadError || !input) throw new Error("Could not load your original photo. Please try again.");
      return `data:${input.type === "image/png" ? "image/png" : "image/jpeg"};base64,${Buffer.from(await input.arrayBuffer()).toString("base64")}`;
    }));
    const paths: string[] = [];
    let frontReference: string | null = null;
    // Prepare sequentially so the back can match this athlete's generated front.
    for (const side of ["front", "back"] as const) {
      const references = side === "front" ? inputs : [inputs[1], inputs[0], ...(frontReference ? [frontReference] : [])];
      // No automatic retries: uncertain paid requests must not be charged twice.
      const response = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: PHOTO_MODEL, prompt: athletePhotoPrompt(side), n: 1, resolution: "1K", aspect_ratio: "2:3", input_references: references.map((url) => ({ type: "image_url", image_url: { url } })), provider: { only: ["google-ai-studio"], allow_fallbacks: false } }),
        signal: AbortSignal.timeout(115000),
      });
      if (!response.ok) {
        console.error("Athlete photo preparation failed", { jobId, side, status: response.status, requestId: response.headers.get("x-request-id") });
        throw new Error(response.status === 429 ? "Photo preparation is busy. Please try again later." : "Photo preparation could not finish. Check your photos and try again, or contact Skinbid.");
      }
      const result = await response.json() as { data?: { b64_json?: string }[]; usage?: unknown };
      const encoded = result.data?.[0]?.b64_json;
      if (!encoded) throw new Error("The image service did not return a photo. Please try again.");
      if (encoded.length > 32 * 1024 * 1024) throw new Error("The prepared photo was too large. Please contact Skinbid.");
      const normalized = await sharp(Buffer.from(encoded, "base64"), { limitInputPixels: 25_000_000 }).autoOrient().resize(1024, 1536, { fit: "contain", background: "#242629" }).jpeg({ quality: 90 }).toBuffer();
      const path = `${media.athlete_id}/generated/${jobId}/${side}.jpg`;
      const { error: saveError } = await db.storage.from(MEDIA_BUCKET).upload(path, normalized, { contentType: "image/jpeg", upsert: false });
      if (saveError) throw new Error("Could not save the prepared photo. Please contact Skinbid before retrying.");
      const { error: recordError } = await db.from("athlete_media_jobs").update({ [`output_${side}`]: path, [`usage_${side}`]: result.usage ?? null }).eq("id", jobId);
      if (recordError) throw new Error("Your photo was saved but its record could not update. Contact Skinbid.");
      paths.push(path);
      if (side === "front") frontReference = `data:image/jpeg;base64,${normalized.toString("base64")}`;
    }
    const { error } = await db.from("athlete_media").update({ candidate_front: paths[0], candidate_back: paths[1], state: "review", error: null, updated_at: new Date().toISOString() }).eq("athlete_id", media.athlete_id).eq("job_id", jobId).eq("state", "processing");
    if (error) throw new Error("Photos are saved but review could not open. Contact Skinbid.");
    await db.from("athlete_media_jobs").update({ status: "ready", finished_at: new Date().toISOString() }).eq("id", jobId);
  } catch (error) {
    const message = error instanceof Error && error.name !== "TimeoutError" ? error.message : "Photo preparation took too long. Your originals are safe. Please try again.";
    await Promise.all([
      db.from("athlete_media").update({ state: "failed", error: message, updated_at: new Date().toISOString() }).eq("athlete_id", media.athlete_id).eq("job_id", jobId),
      db.from("athlete_media_jobs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", jobId),
    ]);
  }
}
