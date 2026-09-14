import type { ZoneName } from "@/lib/zones";

// Anatomical map on the standing GLB. Do not rotate the mesh to hide a bad map.
// 0° / +Z = chest (front of the athlete). 180° / −Z = back.
// L/R is the athlete's left/right: they face the camera at 0°, so their
// left pad sits on the right of the screen (+X, +theta).
export type ZoneHit = {
  zone: ZoneName;
  x: number;
  y: number;
  z: number;
  theta: number;
  phi: number;
  radius: number;
  // Hit ellipsoid half-extents in meters on a 1.7m body. One sphere per
  // slot was stealing neighbors (belly → chest, thigh L ↔ thigh R).
  hx: number;
  hy: number;
  hz: number;
};

export type BodyHitFrame = {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

function hit(
  zone: ZoneName,
  x: number,
  y: number,
  z: number,
  theta: number,
  phi: number,
  radius: number,
  hx: number,
  hy: number,
  hz: number,
): ZoneHit {
  return { zone, x, y, z, theta, phi, radius, hx, hy, hz };
}

export const ZONE_HITS: ZoneHit[] = [
  hit("chest_l", 0.3, 0.76, 0.48, 14, 72, 2.82, 0.08, 0.07, 0.08),
  hit("chest_r", -0.3, 0.76, 0.48, -14, 72, 2.82, 0.08, 0.07, 0.08),
  // Large belly pad: tall midline volume so the whole square picks Abs.
  hit("abs", 0, 0.68, 0.52, 0, 78, 2.78, 0.13, 0.15, 0.14),
  hit("shoulder_l", 0.86, 0.84, 0.22, 90, 70, 2.74, 0.09, 0.08, 0.1),
  hit("shoulder_r", -0.86, 0.84, 0.22, -90, 70, 2.74, 0.09, 0.08, 0.1),
  hit("bicep_l", 0.88, 0.7, 0.22, 90, 76, 2.68, 0.08, 0.11, 0.09),
  hit("bicep_r", -0.88, 0.7, 0.22, -90, 76, 2.68, 0.08, 0.11, 0.09),
  hit("forearm_l", 0.92, 0.5, 0.16, 90, 86, 2.62, 0.07, 0.11, 0.08),
  hit("forearm_r", -0.92, 0.5, 0.16, -90, 86, 2.62, 0.07, 0.11, 0.08),
  hit("back_l", 0.3, 0.74, -0.48, 166, 72, 2.9, 0.08, 0.07, 0.09),
  hit("back_r", -0.3, 0.74, -0.48, -166, 72, 2.9, 0.08, 0.07, 0.09),
  // Thigh L = athlete left = screen-right (+X). Tight X so L/R cannot swap.
  hit("thigh_l", 0.4, 0.38, 0.42, 38, 94, 2.9, 0.065, 0.14, 0.1),
  hit("thigh_r", -0.4, 0.38, 0.42, -38, 94, 2.9, 0.065, 0.14, 0.1),
  hit("thigh_l", 0.4, 0.38, -0.42, 166, 94, 2.96, 0.065, 0.14, 0.1),
  hit("thigh_r", -0.4, 0.38, -0.42, -166, 94, 2.96, 0.065, 0.14, 0.1),
];

export function defaultHitForZone(zone: ZoneName) {
  return ZONE_HITS.find((item) => item.zone === zone) ?? ZONE_HITS[0];
}

export function slotWorld(hit: ZoneHit, frame: BodyHitFrame) {
  return {
    x: frame.center.x + (hit.x * frame.size.x) / 2,
    y: frame.center.y - frame.size.y / 2 + hit.y * frame.size.y,
    z: frame.center.z + (hit.z * frame.size.z) / 2,
  };
}

export function slotNormal(hit: ZoneHit) {
  const mag = Math.hypot(hit.x, 0, hit.z) || 1;
  return {
    x: hit.x / mag,
    y: 0,
    z: hit.z / mag,
  };
}

export function nearestHit(
  frame: BodyHitFrame,
  point: { x: number; y: number; z: number },
) {
  let best: ZoneHit | undefined;
  let bestScore = 1;
  for (const item of ZONE_HITS) {
    // L/R pads never accept a click on the other side of the midline.
    if (item.x !== 0 && item.x * point.x < 0) {
      continue;
    }
    const pos = slotWorld(item, frame);
    const nx = (point.x - pos.x) / item.hx;
    const ny = (point.y - pos.y) / item.hy;
    const nz = (point.z - pos.z) / item.hz;
    const score = nx * nx + ny * ny + nz * nz;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}
