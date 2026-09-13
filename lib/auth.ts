import { loadOwnPayout } from "@/lib/payout";
import { loadProfileRow } from "@/lib/profile";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }
  return adminEmails().includes(email.toLowerCase());
}

export async function getSessionUser() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return { supabase: null, user: null, profile: null as Profile | null };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, profile: null as Profile | null };
  }
  const profile = await loadProfileRow(supabase, user.id);
  if (!profile) {
    return { supabase, user, profile: null };
  }
  const payout = await loadOwnPayout(supabase, user.id);
  return {
    supabase,
    user,
    profile: { ...(profile as Omit<Profile, "payout_rail" | "payout_account">), ...payout },
  };
}
