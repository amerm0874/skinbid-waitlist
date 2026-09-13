import type { SupabaseClient } from "@supabase/supabase-js";
import { destinationAfterAuth, parseRole, type Role } from "@/lib/config";
import { loadOwnPayout } from "@/lib/payout";
import { loadProfileRow } from "@/lib/profile";

export async function destinationForSession(
  supabase: SupabaseClient,
  userId: string,
  role?: Role | null,
  next?: string | null,
) {
  const profile = await loadProfileRow(supabase, userId);
  const payout = profile ? await loadOwnPayout(supabase, userId) : null;
  return destinationAfterAuth(
    profile ? { ...profile, ...payout } : null,
    parseRole(profile?.role) ?? role,
    next,
  );
}
