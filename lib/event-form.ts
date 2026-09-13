import {
  EVENT_MAX_MONTHS,
  EVENT_MIN_DAYS,
} from "@/lib/config";
import { AVATARS_BUCKET, avatarGlbPath, glbFileError } from "@/lib/glb";
import { createBrowserSupabase } from "@/lib/supabase/client";

export {
  AVATARS_BUCKET,
  MAX_GLB_BYTES,
  avatarGlbPath,
  glbFileError,
  isGlbMagic,
} from "@/lib/glb";

export type ListedEvent = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "live";
  date: string;
  city: string | null;
  sport: string | null;
  sport_detail?: string | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateBounds() {
  const min = new Date();
  min.setDate(min.getDate() + EVENT_MIN_DAYS);
  min.setHours(9, 0, 0, 0);
  const max = new Date();
  max.setMonth(max.getMonth() + EVENT_MAX_MONTHS);
  max.setHours(23, 59, 0, 0);
  return { min: toDateTimeLocal(min), max: toDateTimeLocal(max) };
}

export function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Only a .glb marks the body ready. Capture videos never call this.
export async function uploadGlb(userId: string, file: File) {
  const reason = glbFileError(file);
  if (reason) {
    throw new Error(reason);
  }
  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }
  const path = avatarGlbPath(userId);
  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: "model/gltf-binary",
    });
  if (uploadError) {
    throw uploadError;
  }
  const glbUrl = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data
    .publicUrl;
  const { error: avatarError } = await supabase.from("avatars").upsert({
    athlete_id: userId,
    glb_url: `${glbUrl}?v=${Date.now()}`,
    ready: true,
  });
  if (avatarError) {
    throw avatarError;
  }
  console.log("Avatar marked ready from GLB");
}
