// Ported from the web app's lib/event-create.ts avatar-readiness check.
// An event can never really be "live" without a real 3D body scan — the DB
// enforces this with a trigger, and every listing query filters on it too.

function isDemoOrPlaceholderGlb(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("placeholder.glb") || lower.includes("avatar-male.glb") || lower.includes("avatar-female.glb");
}

export function isReadyAvatar(
  avatar: { ready?: boolean | null; glb_url?: string | null } | null | undefined,
): avatar is { ready: true; glb_url: string } {
  const url = avatar?.glb_url?.trim() ?? "";
  if (!avatar?.ready || !url) return false;
  return !isDemoOrPlaceholderGlb(url);
}
