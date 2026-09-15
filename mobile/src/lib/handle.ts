// Ported verbatim from the web app's lib/handle.ts.
// Public athlete URLs are /a/[handle]. We derive the handle from social,
// then from the display name. No extra form field.

const SKIP_PATHS = new Set(["p", "reel", "reels", "stories", "share", "status", "explore"]);

export function normalizeHandle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 48);
}

function handleFromUrl(raw: string) {
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) {
      return null;
    }
    const first = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
    if (!first || SKIP_PATHS.has(first.toLowerCase())) {
      return null;
    }
    return normalizeHandle(first);
  } catch {
    return null;
  }
}

export function handleFromSocial(social: string | null | undefined) {
  const raw = social?.trim() ?? "";
  if (!raw) return null;
  return handleFromUrl(raw) || normalizeHandle(raw) || null;
}

export function slugFromName(name: string | null | undefined) {
  const slug = (name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || null;
}

export function publicAthleteHandle(profile: { social?: string | null; name?: string | null }) {
  return handleFromSocial(profile.social) || slugFromName(profile.name);
}
