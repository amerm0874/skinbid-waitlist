"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import {
  captureEvent,
  identifyUser,
  isPosthogEnabled,
  resetUser,
} from "@/lib/analytics";
import { createBrowserSupabase } from "@/lib/supabase/client";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!isPosthogEnabled()) {
    return children;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogAuth />
      {children}
    </PHProvider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const client = usePostHog();

  useEffect(() => {
    if (!pathname || !client) {
      return;
    }
    const query = searchParams.toString();
    const url = window.origin + pathname + (query ? `?${query}` : "");
    captureEvent("$pageview", { $current_url: url });
  }, [pathname, searchParams, client]);

  return null;
}

function PostHogAuth() {
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        captureEvent("logout");
        resetUser();
        return;
      }
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") {
        return;
      }
      const userId = session?.user?.id;
      if (!userId) {
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      identifyUser(userId, data?.role);
      if (event === "SIGNED_IN") {
        captureEvent("login", { role: data?.role ?? "" });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
