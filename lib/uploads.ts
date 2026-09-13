import { LOGOS_BUCKET, logoClientError } from "@/lib/logo";
import { createBrowserSupabase } from "@/lib/supabase/client";

export async function uploadBrandLogo(userId: string, file: File) {
  const invalid = logoClientError(file);
  if (invalid) {
    throw new Error(invalid);
  }
  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }
  const path = `${userId}/logo.png`;
  const { error } = await supabase.storage.from(LOGOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: "image/png",
  });
  if (error) {
    throw error;
  }
  const publicUrl = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path).data
    .publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}
