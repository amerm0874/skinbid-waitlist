export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const LOGOS_BUCKET = "logos";
export const BANNED_LOGO_LINE =
  "Banned: political, pornographic, hate, or a second brand in this category.";

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
