// Public Supabase URL and anon key only. Service role lives in lib/supabase/admin.ts.

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

export function hasPublicSupabase() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

// Google secrets live in the Supabase dashboard. Hide the button if the
// public client cannot start — do not read GOOGLE_* keys.
export function googleAuthEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && getSupabaseAnonKey(),
  );
}
