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
  const plausible = window.plausible;
  if (typeof plausible !== "function") {
    return;
  }
  plausible("Waitlist Submit", from ? { props: { from } } : undefined);
}
