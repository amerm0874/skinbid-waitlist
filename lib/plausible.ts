"use client";

import { track } from "@vercel/analytics";

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string> },
    ) => void;
  }
}

export function trackWaitlistSubmit(from?: string) {
  if (typeof window === "undefined") {
    return;
  }

  // Vercel Analytics (shows up after deploy, on the Analytics tab).
  track("Waitlist Submit", from ? { from } : undefined);

  const plausible = window.plausible;
  if (typeof plausible !== "function") {
    return;
  }
  plausible("Waitlist Submit", from ? { props: { from } } : undefined);
}
