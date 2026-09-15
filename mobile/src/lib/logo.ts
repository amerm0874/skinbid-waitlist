// Ported from the web app's lib/logo.ts. The File-based browser validation
// is replaced with a version that works on an expo-image-picker asset.

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
export function parseMarkOffer(input: { offer_tattoo?: boolean | null; offer_sticker?: boolean | null }) {
  const tattoo = input.offer_tattoo !== false;
  const sticker = input.offer_sticker !== false;
  if (!tattoo && !sticker) {
    return { tattoo: true, sticker: false, kinds: ["tattoo"] as MarkKind[] };
  }
  return {
    tattoo,
    sticker,
    kinds: [...(tattoo ? (["tattoo"] as const) : []), ...(sticker ? (["sticker"] as const) : [])] as MarkKind[],
  };
}

export function zoneLogoStoragePath(input: { brandId: string; eventId: string; zoneName: ZoneName }) {
  return `${input.brandId}/${input.eventId}/${input.zoneName}.png`;
}

export function postRulesError(value: string) {
  if (value.length > POST_RULES_MAX) {
    return `Keep post rules under ${POST_RULES_MAX} characters.`;
  }
  return "";
}

export function logoAssetError(asset: { mimeType?: string | null; fileSize?: number | null; uri: string } | null) {
  if (!asset) {
    return "Add a PNG logo.";
  }
  const isPng = asset.mimeType === "image/png" || asset.uri.toLowerCase().endsWith(".png");
  if (!isPng) {
    return "Logo must be a PNG.";
  }
  if (asset.fileSize && asset.fileSize > MAX_LOGO_BYTES) {
    return "Logo must be under 2 MB.";
  }
  return "";
}
