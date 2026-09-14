import type { SupabaseClient } from "@supabase/supabase-js";
import { destinationAfterAuth, parseRole, type Role } from "@/lib/config";
import { safeReturnPath } from "@/lib/launch";
import { isLogoDeskNext } from "@/lib/logo";
import { loadProfileRow } from "@/lib/profile";

export async function destinationForSession(
  supabase: SupabaseClient,
  userId: string,
  role?: Role | null,
  next?: string | null,
) {
  const profile = await loadProfileRow(supabase, userId);
  const returnTo = safeReturnPath(next ?? null);
  if (returnTo && isLogoDeskNext(returnTo)) {
    return returnTo;
  }
  return destinationAfterAuth(
    profile,
    parseRole(profile?.role) ?? role,
    returnTo,
  );
}
