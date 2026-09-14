import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseCookieOptions } from "@/lib/auth-return";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export async function createServerSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return null;
  }

  const cookieStore = await cookies();
  const hostname = (await headers()).get("host") ?? "";

  return createServerClient(url, key, {
    cookieOptions: supabaseCookieOptions(hostname),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component. Middleware still refreshes the session.
        }
      },
    },
  });
}
