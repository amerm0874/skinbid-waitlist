import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const cut = trimmed.indexOf("=");
    if (cut <= 0) {
      continue;
    }
    const key = trimmed.slice(0, cut);
    let value = trimmed.slice(cut + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function catalogRows() {
  const src = readFileSync(resolve(process.cwd(), "lib/official-events.ts"), "utf8");
  const start = src.indexOf("const OFFICIAL_EVENT_ROWS");
  const end = src.indexOf("export const OFFICIAL_EVENTS");
  const block = src.slice(start, end);
  const rows = [];
  const pattern =
    /starts_on:\s*"(\d{4}-\d{2}-\d{2})"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?official_url:\s*\n?\s*"([^"]+)"/g;
  for (const match of block.matchAll(pattern)) {
    rows.push({
      starts_on: match[1],
      name: match[2],
      official_url: match[3],
    });
  }
  return rows;
}

function metaContent(html, property) {
  const named = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  return (html.match(named)?.[1] || html.match(reversed)?.[1] || "").trim();
}

function absoluteHttpUrl(raw, pageUrl) {
  try {
    const href = new URL(raw.replace(/&amp;/g, "&"), pageUrl).href;
    if (!/^https?:\/\//i.test(href)) {
      return null;
    }
    return href;
  } catch {
    return null;
  }
}

async function ogImageFromPage(pageUrl) {
  const response = await fetch(pageUrl, {
    cache: "no-store",
    headers: {
      accept: "text/html",
      "user-agent":
        "Mozilla/5.0 (compatible; SkinBid/1.0; +https://www.skinbid.me)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return null;
  }
  const html = (await response.text()).slice(0, 500_000);
  const image =
    metaContent(html, "og:image") ||
    metaContent(html, "og:image:secure_url") ||
    metaContent(html, "twitter:image");
  return image ? absoluteHttpUrl(image, pageUrl) : null;
}

async function mapChunk(items, size, work) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    out.push(...(await Promise.all(chunk.map(work))));
  }
  return out;
}

loadEnv();

const rows = catalogRows();
if (rows.length === 0) {
  console.error("No catalog rows found.");
  process.exit(1);
}

const uniqueUrls = [...new Set(rows.map((row) => row.official_url))];
const foundPairs = await mapChunk(uniqueUrls, 3, async (pageUrl) => {
  try {
    return [pageUrl, await ogImageFromPage(pageUrl)];
  } catch {
    return [pageUrl, null];
  }
});
const found = new Map(foundPairs);
const cache = {};
let saved = 0;

for (const row of rows) {
  const ogImageUrl = found.get(row.official_url) ?? null;
  if (ogImageUrl) {
    cache[row.starts_on] = ogImageUrl;
    saved += 1;
  }
  console.log(
    ogImageUrl ? "SAVED" : "NONE",
    row.starts_on,
    row.name,
    ogImageUrl || "",
  );
}

writeFileSync(
  resolve(process.cwd(), "lib/official-og-cache.json"),
  `${JSON.stringify(cache, null, 2)}\n`,
);

const url =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
if (url && key) {
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const checkedAt = new Date().toISOString();
  for (const row of rows) {
    const ogImageUrl = found.get(row.official_url) ?? null;
    const { error } = await admin
      .from("official_events")
      .update({
        og_image_url: ogImageUrl,
        og_image_checked_at: checkedAt,
      })
      .eq("starts_on", row.starts_on);
    if (error && !/og_image_url/.test(error.message)) {
      console.log("DB FAIL", row.starts_on, error.message);
    }
  }
}

const rome = found.get(
  rows.find((row) => row.starts_on === "2026-09-23")?.official_url,
);
console.log(
  JSON.stringify({
    missing: rows.length,
    fetched: uniqueUrls.length,
    saved,
    rome: rome ?? null,
  }),
);
