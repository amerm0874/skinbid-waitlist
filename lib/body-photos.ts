import { PHOTOS_BUCKET } from "@/lib/photo";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { loadAthleteMedia, signMedia } from "@/lib/athlete-media";

export type BodyPhotos = {
  front: string | null;
  back: string | null;
};

// One source of truth for /e/mohamed-test (and demo): public/body, not the
// photos bucket. Cache-bust so old 3D plates are not reused.
export const PUBLIC_BODY_PHOTOS: BodyPhotos = {
  front: "/body/front.jpg?v=athlete",
  back: "/body/back.jpg?v=athlete",
};

export const PUBLIC_BODY_SLUGS = new Set(["mohamed-test"]);

const SIDES = ["front", "back"] as const;
type Side = (typeof SIDES)[number];

// Convention over schema: the stage looks for photos/<athleteId>/front.* and
// /back.* rather than adding columns. Same pattern the demo zone logos use.
export async function loadBodyPhotos(
  athleteId: string | null | undefined,
): Promise<BodyPhotos> {
  const empty: BodyPhotos = { front: null, back: null };
  const id = athleteId?.trim();
  const admin = createAdminSupabase();
  if (!id || !admin) {
    return empty;
  }

  const media = await loadAthleteMedia(id);
  if (media?.approved_front && media.approved_back) {
    const [front, back] = await Promise.all([signMedia(media.approved_front), signMedia(media.approved_back)]);
    return { front, back };
  }
  const listed = await admin.storage.from(PHOTOS_BUCKET).list(id, { limit: 50 });
  // A replacement can have a different extension. Always use the newest upload.
  const files = [...(listed.data ?? [])].sort((a, b) => (Date.parse(b.updated_at ?? "") || 0) - (Date.parse(a.updated_at ?? "") || 0));
  const out: BodyPhotos = { front: null, back: null };

  for (const side of SIDES) {
    const match = files.find((file) => {
      const name = file.name.toLowerCase();
      return (
        name === `${side}.jpg` ||
        name === `${side}.jpeg` ||
        name === `${side}.png` ||
        name === `${side}.webp`
      );
    });
    if (!match) {
      continue;
    }
    const path = `${id}/${match.name}`;
    const url = admin.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data
      .publicUrl;
    const version = Date.parse(match.updated_at ?? "") || 0;
    out[side as Side] = version ? `${url}?v=${version}` : url;
  }

  return out;
}
