import { isZoneName, type ZoneName } from "@/lib/zones";
import type { ZoneRect } from "@/lib/zone-photos";
import type { createServerSupabase } from "@/lib/supabase/server";
import type { createAdminSupabase } from "@/lib/supabase/admin";

type Db =
  | NonNullable<Awaited<ReturnType<typeof createServerSupabase>>>
  | NonNullable<ReturnType<typeof createAdminSupabase>>;

export type AthleteZoneRects = Partial<Record<ZoneName, ZoneRect>>;

type RectRow = {
  zone_name: string;
  x: number | string;
  y: number | string;
  w: number | string;
  h: number | string;
};

function num(value: number | string) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function parseZoneRect(input: {
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
}): ZoneRect | null {
  const x = num(input.x as number | string);
  const y = num(input.y as number | string);
  const w = num(input.w as number | string);
  const h = num(input.h as number | string);
  if (![x, y, w, h].every((value) => Number.isFinite(value))) {
    return null;
  }
  const left = Math.min(99, Math.max(0, x));
  const top = Math.min(99, Math.max(0, y));
  const width = Math.min(100 - left, Math.max(1, w));
  const height = Math.min(100 - top, Math.max(1, h));
  return {
    x: Math.round(left * 10) / 10,
    y: Math.round(top * 10) / 10,
    w: Math.round(width * 10) / 10,
    h: Math.round(height * 10) / 10,
  };
}

export function rowsToAthleteZoneRects(rows: RectRow[] | null | undefined) {
  const out: AthleteZoneRects = {};
  for (const row of rows ?? []) {
    if (!isZoneName(row.zone_name)) {
      continue;
    }
    const rect = parseZoneRect(row);
    if (rect) {
      out[row.zone_name] = rect;
    }
  }
  return out;
}

export async function loadAthleteZoneRects(
  db: Db,
  athleteId: string,
): Promise<AthleteZoneRects> {
  const id = athleteId.trim();
  if (!id) {
    return {};
  }
  const { data, error } = await db
    .from("athlete_zone_rects")
    .select("zone_name, x, y, w, h")
    .eq("athlete_id", id);
  if (error) {
    console.log("athlete_zone_rects load failed", error.message);
    return {};
  }
  return rowsToAthleteZoneRects(data as RectRow[] | null);
}
