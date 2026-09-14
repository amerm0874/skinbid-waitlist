import { safeReturnPath } from "@/lib/launch";
import type { ZoneName } from "@/lib/zones";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGOS_BUCKET = "logos";
export const POST_RULES_MAX = 280;
export const BANNED_LOGO_LINE =
  "Banned: political, pornographic, hate, or a second brand in this category.";

export const MARK_KINDS = ["tattoo", "sticker"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

export const MARK_KIND_LABEL: Record<MarkKind, string> = {
  tattoo: "Tattoo",
  sticker: "Sticker",
};

export function isMarkKind(value: string | null | undefined): value is MarkKind {
  return value === "tattoo" || value === "sticker";
}

// Athlete listing: tattoo, sticker, or both. Never neither.
export function parseMarkOffer(input: {
  offer_tattoo?: boolean | null;
  offer_sticker?: boolean | null;
}) {
  const tattoo = input.offer_tattoo !== false;
  const sticker = input.offer_sticker !== false;
  if (!tattoo && !sticker) {
    return {
      tattoo: true,
      sticker: false,
      kinds: ["tattoo"] as MarkKind[],
    };
  }
  return {
    tattoo,
    sticker,
    kinds: [
      ...(tattoo ? (["tattoo"] as const) : []),
      ...(sticker ? (["sticker"] as const) : []),
    ] as MarkKind[],
  };
}

export function logoDeskPath(slug: string, bidId?: string | null) {
  const path = `/e/${slug}/logo`;
  if (!bidId) {
    return path;
  }
  return `${path}?bid_id=${encodeURIComponent(bidId)}`;
}

export function isLogoDeskNext(next: string | null | undefined) {
  const path = (next ?? "").trim().split("?")[0] ?? "";
  return /^\/e\/[^/]+\/logo$/.test(path);
}

export function resolveLogoAuthNext(
  next: string | null | undefined,
  bidId?: string | null,
) {
  const returnTo = safeReturnPath(next ?? null);
  if (!returnTo) {
    return "";
  }
  const bid = (bidId ?? "").trim();
  if (!bid || !isLogoDeskNext(returnTo) || /(?:^|[?&])bid_id=/.test(returnTo)) {
    return returnTo;
  }
  const slug = (returnTo.split("?")[0] ?? "").split("/").filter(Boolean)[1] ?? "";
  if (!slug) {
    return returnTo;
  }
  return logoDeskPath(slug, bid);
}

export function zoneLogoStoragePath(input: {
  brandId: string;
  eventId: string;
  zoneName: ZoneName;
}) {
  return `${input.brandId}/${input.eventId}/${input.zoneName}.png`;
}

export function demoLogoStoragePath(zoneName: ZoneName) {
  return `demo/${zoneName}.png`;
}

export function postRulesError(value: string) {
  if (value.length > POST_RULES_MAX) {
    return `Keep post rules under ${POST_RULES_MAX} characters.`;
  }
  return "";
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const BANNED_MARKS = [
  "biden",
  "communist",
  "communism",
  "democrat",
  "faggot",
  "fascism",
  "fascist",
  "gop",
  "harris",
  "hentai",
  "hitler",
  "kamala",
  "kike",
  "kkk",
  "klan",
  "maga",
  "marxist",
  "naked",
  "nazi",
  "nazis",
  "nigga",
  "nigger",
  "nsfw",
  "nude",
  "nudes",
  "nudity",
  "onlyfans",
  "political",
  "porn",
  "pornhub",
  "porno",
  "pornography",
  "racist",
  "republican",
  "swastika",
  "trump",
  "white power",
  "white pride",
  "whitepower",
  "xxx",
];

export function isPngFile(file: { type: string; name: string }) {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

export function isPngBytes(bytes: Uint8Array) {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

export function isBannedLogoText(...parts: Array<string | null | undefined>) {
  const tokens = parts
    .flatMap((part) =>
      (part ?? "")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .split(/[^a-z0-9]+/),
    )
    .filter(Boolean);
  if (!tokens.length) {
    return false;
  }
  const glued = tokens.join("");
  const spaced = ` ${tokens.join(" ")} `;
  return BANNED_MARKS.some((mark) => {
    if (mark.includes(" ")) {
      return spaced.includes(` ${mark} `);
    }
    if (tokens.includes(mark)) {
      return true;
    }
    return mark.length >= 5 && glued.includes(mark);
  });
}

export function logoClientError(file: File | null) {
  if (!file) {
    return "Add a PNG logo.";
  }
  if (!isPngFile(file)) {
    return "Logo must be a PNG.";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Logo must be under 2 MB.";
  }
  if (isBannedLogoText(file.name)) {
    return BANNED_LOGO_LINE;
  }
  return "";
}
