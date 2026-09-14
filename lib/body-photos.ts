import { PHOTOS_BUCKET } from "@/lib/photo";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type BodyPhotos = {
  front: string | null;
  back: string | null;
};

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

  const listed = await admin.storage.from(PHOTOS_BUCKET).list(id, { limit: 50 });
  const files = listed.data ?? [];
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
