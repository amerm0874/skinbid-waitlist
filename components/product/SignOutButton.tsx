"use client";

import { resetUser } from "@/lib/analytics";
import { clearBrowserAuth } from "@/lib/auth-client";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function SignOutButton() {
  async function signOut() {
    const supabase = createBrowserSupabase();
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        console.log("Sign out failed", error.message);
      }
    }
    resetUser();
    clearBrowserAuth();
    window.location.replace("/auth/signout");
  }

  return (
    <button type="button" onClick={() => void signOut()}>
      Sign out
    </button>
  );
}
