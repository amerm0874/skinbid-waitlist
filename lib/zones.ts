export const ZONE_NAMES = [
  "chest_l",
  "chest_r",
  "shoulder_l",
  "shoulder_r",
  "bicep_l",
  "bicep_r",
  "forearm_l",
  "forearm_r",
  "back_l",
  "back_r",
  "thigh_l",
  "thigh_r",
] as const;

export type ZoneName = (typeof ZONE_NAMES)[number];

export const ZONE_LABEL: Record<ZoneName, string> = {
  chest_l: "Chest L",
  chest_r: "Chest R",
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

// Hit boxes sit on a standing figure ~1.7m, origin at the feet, Y up.
export const ZONE_LAYOUT: Record<
  ZoneName,
  { x: number; y: number; z: number; w: number; h: number; d: number }
> = {
  chest_l: { x: -0.12, y: 1.32, z: 0.12, w: 0.18, h: 0.16, d: 0.08 },
  chest_r: { x: 0.12, y: 1.32, z: 0.12, w: 0.18, h: 0.16, d: 0.08 },
  shoulder_l: { x: -0.28, y: 1.42, z: 0.04, w: 0.16, h: 0.12, d: 0.12 },
  shoulder_r: { x: 0.28, y: 1.42, z: 0.04, w: 0.16, h: 0.12, d: 0.12 },
  bicep_l: { x: -0.38, y: 1.18, z: 0.02, w: 0.12, h: 0.18, d: 0.12 },
  bicep_r: { x: 0.38, y: 1.18, z: 0.02, w: 0.12, h: 0.18, d: 0.12 },
  forearm_l: { x: -0.42, y: 0.92, z: 0.02, w: 0.1, h: 0.2, d: 0.1 },
  forearm_r: { x: 0.42, y: 0.92, z: 0.02, w: 0.1, h: 0.2, d: 0.1 },
  back_l: { x: -0.12, y: 1.32, z: -0.12, w: 0.18, h: 0.16, d: 0.08 },
  back_r: { x: 0.12, y: 1.32, z: -0.12, w: 0.18, h: 0.16, d: 0.08 },
  thigh_l: { x: -0.12, y: 0.72, z: 0.08, w: 0.16, h: 0.28, d: 0.12 },
  thigh_r: { x: 0.12, y: 0.72, z: 0.08, w: 0.16, h: 0.28, d: 0.12 },
};

export function isZoneName(value: string): value is ZoneName {
  return (ZONE_NAMES as readonly string[]).includes(value);
}

// Highest held bid, else first open zone. Callers show floor when current_cents is null.
export function featuredSlot(
  zones: Array<{
    name: string;
    status?: string;
    current_cents?: number | null;
  }>,
) {
  const rows = zones.filter((zone): zone is typeof zone & { name: ZoneName } =>
    isZoneName(zone.name),
  );
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
