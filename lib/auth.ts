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
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, role, name, country, social, brand_category, website, logo_url",
    )
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, profile: (profile as Profile | null) ?? null };
}
