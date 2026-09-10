// Waitlist launch: hide the unfinished marketplace until we turn this off.
// Set WAITLIST_ONLY=false in .env when auctions should go live.

const HIDDEN_PAGES = new Set([
  "events",
  "login",
  "admin",
  "new",
  "outreach",
  "onboarding",
  "e",
  "proof",
]);

const HIDDEN_APIS = new Set(["bids", "events", "admin", "outreach"]);

function firstSegment(pathname: string, index: number) {
  return pathname.split("/").filter(Boolean)[index] ?? "";
}

export function isWaitlistOnly() {
  return process.env.WAITLIST_ONLY !== "false";
}

export function isHiddenWaitlistPage(pathname: string) {
  return HIDDEN_PAGES.has(firstSegment(pathname, 0));
}

export function isHiddenWaitlistApi(pathname: string) {
  if (!pathname.startsWith("/api/")) {
    return false;
  }
  return HIDDEN_APIS.has(firstSegment(pathname, 1));
}

// Only allow same-site paths like /waitlist — never https://evil.com
export function safeNextPath(raw: string | null, fallback = "/") {
  if (!raw) {
    return fallback;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  return raw;
}
