// Ported verbatim from the web app's lib/zones.ts (minus the 3D layout coords,
// which only matter to the web's model-viewer body cage).

export const ZONE_NAMES = [
  "chest_l", "chest_r", "abs", "shoulder_l", "shoulder_r", "bicep_l", "bicep_r",
  "forearm_l", "forearm_r", "back_l", "back_r", "thigh_l", "thigh_r",
] as const;

export type ZoneName = (typeof ZONE_NAMES)[number];

export const ZONE_LABEL: Record<ZoneName, string> = {
  chest_l: "Chest L",
  chest_r: "Chest R",
  abs: "Abs",
  shoulder_l: "Shoulder L",
  shoulder_r: "Shoulder R",
  bicep_l: "Bicep L",
  bicep_r: "Bicep R",
  forearm_l: "Forearm L",
  forearm_r: "Forearm R",
  back_l: "Back L",
  back_r: "Back R",
  thigh_l: "Thigh L",
  thigh_r: "Thigh R",
};

export function isZoneName(value: string): value is ZoneName {
  return (ZONE_NAMES as readonly string[]).includes(value);
}

// Highest held bid, else first open zone. Callers show floor when current_cents is null.
export function featuredSlot(
  zones: Array<{ name: string; status?: string; current_cents?: number | null }>,
) {
  const rows = zones.filter((zone): zone is typeof zone & { name: ZoneName } => isZoneName(zone.name));
  const withBid = rows
    .filter((zone) => (zone.current_cents ?? 0) > 0)
    .sort((a, b) => (b.current_cents ?? 0) - (a.current_cents ?? 0))[0];
  const open = rows.find((zone) => zone.status !== "closed");
  const pick = withBid ?? open ?? rows[0];
  const name = pick?.name ?? "chest_l";
  return {
    name,
    label: ZONE_LABEL[name],
    current_cents: pick?.current_cents ?? null,
  };
}
