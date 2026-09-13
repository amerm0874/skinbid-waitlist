import { isMissingColumn, isMissingRelation } from "@/lib/db-error";
import { fetchOfficialPageFacts } from "@/lib/official-page";
import {
  loadAllUpcomingOfficialEvents,
  rememberSavedOgImage,
  storedOgImageUrl,
  type OfficialEvent,
} from "@/lib/official-events";
import { createAdminSupabase } from "@/lib/supabase/admin";

const OG_FETCH_CHUNK = 3;

function needsOgFetch(row: OfficialEvent) {
  return !storedOgImageUrl(row.og_image_url) && !row.og_image_checked_at;
}

function needsFactsFetch(row: OfficialEvent) {
  return !row.facts_checked_at;
}

async function mapChunk<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>,
) {
  const out: R[] = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    out.push(...(await Promise.all(chunk.map(work))));
  }
  return out;
}

async function persistOfficialFacts(
  rows: {
    starts_on: string;
    og_image_url: string | null;
    venue: string | null;
    facts_checked_at: string;
  }[],
) {
  for (const row of rows) {
    rememberSavedOgImage(row.starts_on, row.og_image_url);
  }
  const admin = createAdminSupabase();
  if (!admin || rows.length === 0) {
    return;
  }
  await Promise.all(
    rows.map(async (row) => {
      const payload: Record<string, string | null> = {
        og_image_url: row.og_image_url,
        og_image_checked_at: row.facts_checked_at,
        venue: row.venue,
        facts_checked_at: row.facts_checked_at,
      };
      const { error } = await admin
        .from("official_events")
        .update(payload)
        .eq("starts_on", row.starts_on);
      if (!error) {
        return;
      }
      if (isMissingRelation(error, "official_events")) {
        return;
      }
      if (isMissingColumn(error, "venue") || isMissingColumn(error, "facts_checked_at")) {
        const photoOnly = await admin
          .from("official_events")
          .update({
            og_image_url: row.og_image_url,
            og_image_checked_at: row.facts_checked_at,
          })
          .eq("starts_on", row.starts_on);
        if (
          photoOnly.error &&
          !isMissingColumn(photoOnly.error, "og_image_url")
        ) {
          console.log("Official OG save failed", photoOnly.error.message);
        }
        return;
      }
      if (!isMissingColumn(error, "og_image_url")) {
        console.log("Official facts save failed", error.message);
      }
    }),
  );
}

async function persistOfficialOgImages(
  rows: { starts_on: string; og_image_url: string | null }[],
) {
  for (const row of rows) {
    rememberSavedOgImage(row.starts_on, row.og_image_url);
  }
  const admin = createAdminSupabase();
  if (!admin || rows.length === 0) {
    return 0;
  }
  const checkedAt = new Date().toISOString();
  const saved = await Promise.all(
    rows.map(async (row) => {
      const { data, error } = await admin
        .from("official_events")
        .update({
          og_image_url: row.og_image_url,
          og_image_checked_at: checkedAt,
        })
        .eq("starts_on", row.starts_on)
        .select("starts_on, og_image_url")
        .maybeSingle();
      if (
        error &&
        !isMissingRelation(error, "official_events") &&
        !isMissingColumn(error, "og_image_url")
      ) {
        console.log("Official OG save failed", row.starts_on, error.message);
        return false;
      }
      if (!data) {
        console.log("Official OG save missed row", row.starts_on);
        return false;
      }
      return Boolean(storedOgImageUrl(row.og_image_url));
    }),
  );
  return saved.filter(Boolean).length;
}

async function fetchOgByOfficialUrl(urls: string[]) {
  return new Map(
    await mapChunk(urls, OG_FETCH_CHUNK, async (url) => {
      const facts = await fetchOfficialPageFacts(url);
      return [url, storedOgImageUrl(facts.og_image_url)] as const;
    }),
  );
}

// Background job / race page only. Never call this from the Events grid request.
export async function withOfficialOgImages(
  rows: OfficialEvent[],
): Promise<OfficialEvent[]> {
  const missing = rows.filter(needsOgFetch);
  if (missing.length === 0) {
    return rows;
  }
  const uniqueUrls = [...new Set(missing.map((row) => row.official_url))];
  const found = await fetchOgByOfficialUrl(uniqueUrls);
  const written = missing.map((row) => ({
    starts_on: row.starts_on,
    og_image_url: found.get(row.official_url) ?? null,
  }));
  await persistOfficialOgImages(written);
  const byDate = new Map(
    written.map((row) => [row.starts_on, row.og_image_url]),
  );
  const checkedAt = new Date().toISOString();
  return rows.map((row) => {
    if (!byDate.has(row.starts_on)) {
      return row;
    }
    return {
      ...row,
      og_image_url: byDate.get(row.starts_on) ?? null,
      og_image_checked_at: checkedAt,
    };
  });
}

// One official page read per race. Saves venue + photo. Skips if already checked.
export async function withOfficialPageFacts(
  rows: OfficialEvent[],
): Promise<OfficialEvent[]> {
  const missing = rows.filter(
    (row) => needsFactsFetch(row) || needsOgFetch(row),
  );
  if (missing.length === 0) {
    return rows;
  }
  const uniqueUrls = [...new Set(missing.map((row) => row.official_url))];
  const found = new Map(
    await mapChunk(uniqueUrls, 1, async (url) => [
      url,
      await fetchOfficialPageFacts(url),
    ] as const),
  );
  const checkedAt = new Date().toISOString();
  const written = missing.map((row) => {
    const facts = found.get(row.official_url);
    return {
      starts_on: row.starts_on,
      og_image_url:
        storedOgImageUrl(facts?.og_image_url) ??
        storedOgImageUrl(row.og_image_url),
      venue: facts?.venue ?? row.venue,
      facts_checked_at: checkedAt,
    };
  });
  await persistOfficialFacts(written);
  const byDate = new Map(written.map((row) => [row.starts_on, row]));
  return rows.map((row) => {
    const next = byDate.get(row.starts_on);
    if (!next) {
      return row;
    }
    return {
      ...row,
      og_image_url: next.og_image_url,
      og_image_checked_at: checkedAt,
      venue: next.venue,
      facts_checked_at: checkedAt,
    };
  });
}

// One-time fill. Visits each official_url once, saves og_image, then no-ops.
export async function fillMissingOfficialOgImages() {
  const admin = createAdminSupabase();
  if (!admin) {
    return { missing: 0, fetched: 0, saved: 0, error: "No service role key" };
  }
  const rows = await loadAllUpcomingOfficialEvents(admin);
  const missing = rows.filter(needsOgFetch);
  if (missing.length === 0) {
    return { missing: 0, fetched: 0, saved: 0 };
  }
  const uniqueUrls = [...new Set(missing.map((row) => row.official_url))];
  const found = await fetchOgByOfficialUrl(uniqueUrls);
  const written = missing.map((row) => ({
    starts_on: row.starts_on,
    name: row.name,
    official_url: row.official_url,
    og_image_url: found.get(row.official_url) ?? null,
  }));
  const saved = await persistOfficialOgImages(written);
  const rome = written.find((row) => row.starts_on === "2026-09-23");
  return {
    missing: missing.length,
    fetched: uniqueUrls.length,
    saved,
    rome: rome?.og_image_url ?? null,
  };
}
