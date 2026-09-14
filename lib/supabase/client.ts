import { createBrowserClient } from "@supabase/ssr";
import { supabaseCookieOptions } from "@/lib/auth-return";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  googleAuthEnabled,
  hasPublicSupabase,
} from "@/lib/supabase/env";

export { googleAuthEnabled, hasPublicSupabase };

export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || getSupabaseUrl();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    getSupabaseAnonKey();
  if (!url || !key) {
    return null;
  }
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  return createBrowserClient(url, key, {
    cookieOptions: supabaseCookieOptions(hostname),
  });
}
