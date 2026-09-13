// Waitlist landing stays on `/` and `/waitlist`.
// Set WAITLIST_ONLY=true to hide product URLs. Unset or false unlocks them.

const HIDDEN_PAGES = new Set([
  "events",
  "login",
  "signup",
  "admin",
  "new",
  "outreach",
  "onboarding",
  "e",
  "races",
  "a",
  "proof",
  "me",
  "settings",
  "inbox",
]);

const HIDDEN_APIS = new Set(["bids", "events", "admin", "outreach"]);

function firstSegment(pathname: string, index: number) {
  return pathname.split("/").filter(Boolean)[index] ?? "";
}

export function isWaitlistOnly() {
  return process.env.WAITLIST_ONLY === "true";
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
  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("://") ||
    raw.includes("\\")
  ) {
    return fallback;
  }
  return raw;
}

const BLOCKED_RETURN_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/auth/callback",
]);

// Post-auth return. Never send people to `/` or back through login.
export function safeReturnPath(raw: string | null) {
  const next = safeNextPath(raw, "");
  if (!next) {
    return "";
  }
  const pathOnly = next.split("?")[0] ?? "";
  if (BLOCKED_RETURN_PATHS.has(pathOnly)) {
    return "";
  }
  if (/(?:^|[?&])error=/.test(next)) {
    return "";
  }
  return next;
}

export function isAuthErrorQuery(params: { get(name: string): string | null }) {
  return Boolean(
    params.get("error") ||
      params.get("error_code") ||
      params.get("error_description"),
  );
}

export function isBadOAuthState(params: { get(name: string): string | null }) {
  const code = (params.get("error_code") ?? "").toLowerCase();
  const error = (params.get("error") ?? "").toLowerCase();
  const description = (params.get("error_description") ?? "").toLowerCase();
  return (
    code === "bad_oauth_state" ||
    error.includes("bad_oauth_state") ||
    description.includes("bad_oauth_state")
  );
}
