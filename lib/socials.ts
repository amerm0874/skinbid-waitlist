export const SOCIAL_NETWORKS = [
  "Instagram",
  "X",
  "TikTok",
  "YouTube",
  "Strava",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type SocialAccount = {
  network: SocialNetwork;
  handle: string;
};

export const SOCIAL_MAX = 4;

export function isSocialNetwork(
  value: string | null | undefined,
): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value ?? "");
}

export function emptySocialRow(): SocialAccount {
  return { network: "Instagram", handle: "" };
}

function stripHandle(raw: string) {
  return raw.trim().replace(/^@+/, "");
}

export function socialUrl(network: SocialNetwork, handle: string) {
  const value = stripHandle(handle);
  if (!value) {
    return "";
  }
  if (network === "Instagram") {
    return `https://instagram.com/${value}`;
  }
  if (network === "X") {
    return `https://x.com/${value}`;
  }
  if (network === "TikTok") {
    return `https://tiktok.com/@${value}`;
  }
  if (network === "YouTube") {
    return `https://youtube.com/@${value}`;
  }
  return `https://www.strava.com/athletes/${value}`;
}

function networkFromText(raw: string): SocialNetwork {
  const lower = raw.toLowerCase();
  if (lower.includes("x.com") || lower.includes("twitter.com")) {
    return "X";
  }
  if (lower.includes("tiktok.com")) {
    return "TikTok";
  }
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return "YouTube";
  }
  if (lower.includes("strava.com")) {
    return "Strava";
  }
  return "Instagram";
}

function handleFromText(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    if (url.hostname.includes(".")) {
      const part = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return stripHandle(part);
    }
  } catch {
    // Plain handle.
  }
  return stripHandle(trimmed);
}

export function parseSocialAccounts(
  socials: unknown,
  social?: string | null,
): SocialAccount[] {
  if (Array.isArray(socials)) {
    const rows = socials
      .map((row) => {
        if (!row || typeof row !== "object") {
          return null;
        }
        const record = row as { network?: unknown; handle?: unknown };
        if (!isSocialNetwork(String(record.network ?? ""))) {
          return null;
        }
        return {
          network: record.network as SocialNetwork,
          handle: stripHandle(String(record.handle ?? "")),
        };
      })
      .filter((row): row is SocialAccount => Boolean(row));
    if (rows.length > 0) {
      return rows.slice(0, SOCIAL_MAX);
    }
  }
  const fallback = handleFromText(social ?? "");
  if (fallback) {
    return [
      {
        network: networkFromText(social ?? ""),
        handle: fallback,
      },
    ];
  }
  return [emptySocialRow()];
}

export function filledSocialAccounts(rows: SocialAccount[]) {
  return rows
    .map((row) => ({
      network: row.network,
      handle: stripHandle(row.handle),
    }))
    .filter((row) => row.handle)
    .slice(0, SOCIAL_MAX);
}

export function publicSocialLinks(socials: unknown, social?: string | null) {
  return filledSocialAccounts(parseSocialAccounts(socials, social)).map((row) => ({
    network: row.network,
    href: socialUrl(row.network, row.handle),
    label: `@${row.handle}`,
  }));
}
