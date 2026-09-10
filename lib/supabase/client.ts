import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export function hasPublicSupabase() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function createBrowserSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return null;
  }
  return createBrowserClient(url, key);
}
