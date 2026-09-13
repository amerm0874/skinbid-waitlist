import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  googleAuthEnabled,
  hasPublicSupabase,
} from "@/lib/supabase/env";

export { googleAuthEnabled, hasPublicSupabase };

export function createBrowserSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return null;
  }
  return createBrowserClient(url, key);
}
