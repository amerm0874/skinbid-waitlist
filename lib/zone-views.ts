import type { ZoneName } from "@/lib/zones";

// Same camera map as the landing body viewer. 0° = chest, 90° = right,
// −90° = left, 180° = back. Higher phi looks lower (thighs / forearms).
export type ZoneHit = {
  zone: ZoneName;
  x: number;
  y: number;
  z: number;
  theta: number;
  phi: number;
  radius: number;
};

export const ZONE_HITS: ZoneHit[] = [
  { zone: "chest_l", x: -0.3, y: 0.75, z: 0.48, theta: -14, phi: 72, radius: 2.82 },
  { zone: "chest_r", x: 0.3, y: 0.75, z: 0.48, theta: 14, phi: 72, radius: 2.82 },
  { zone: "shoulder_l", x: -0.86, y: 0.83, z: 0.16, theta: -90, phi: 70, radius: 2.74 },
  { zone: "shoulder_r", x: 0.86, y: 0.83, z: 0.16, theta: 90, phi: 70, radius: 2.74 },
  { zone: "bicep_l", x: -0.88, y: 0.7, z: 0.18, theta: -90, phi: 76, radius: 2.68 },
  { zone: "bicep_r", x: 0.88, y: 0.7, z: 0.18, theta: 90, phi: 76, radius: 2.68 },
  { zone: "forearm_l", x: -0.9, y: 0.52, z: 0.14, theta: -90, phi: 86, radius: 2.62 },
  { zone: "forearm_r", x: 0.9, y: 0.52, z: 0.14, theta: 90, phi: 86, radius: 2.62 },
  { zone: "back_l", x: -0.3, y: 0.74, z: -0.48, theta: 180, phi: 72, radius: 2.9 },
  { zone: "back_r", x: 0.3, y: 0.74, z: -0.48, theta: 180, phi: 72, radius: 2.9 },
  { zone: "thigh_l", x: -0.42, y: 0.42, z: 0.4, theta: -38, phi: 94, radius: 2.9 },
  { zone: "thigh_r", x: 0.42, y: 0.42, z: 0.4, theta: 38, phi: 94, radius: 2.9 },
  { zone: "thigh_l", x: -0.4, y: 0.42, z: -0.42, theta: 180, phi: 94, radius: 2.96 },
  { zone: "thigh_r", x: 0.4, y: 0.42, z: -0.42, theta: 180, phi: 94, radius: 2.96 },
];

export function defaultHitForZone(zone: ZoneName) {
  return ZONE_HITS.find((hit) => hit.zone === zone) ?? ZONE_HITS[0];
}
