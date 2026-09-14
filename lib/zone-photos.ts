import { ZONE_NAMES, type ZoneName } from "@/lib/zones";

export type ZonePhotoSide = "front" | "back";

/** Percent of the photo box. x/y is the top-left corner. */
export type ZoneRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ZonePlacement = {
  photo: ZonePhotoSide;
  rect: ZoneRect;
};

// Authored against public/body/front.jpg and back.jpg (standing, head-to-toe).
// L/R is the athlete's own left/right: on FRONT their left is the viewer's
// right; on BACK their left is the viewer's left.
export const ZONE_PHOTOS: Record<ZoneName, ZonePlacement> = {
  shoulder_l: { photo: "front", rect: { x: 63.5, y: 11.8, w: 5.6, h: 5.2 } },
  shoulder_r: { photo: "front", rect: { x: 31.2, y: 11.8, w: 5.6, h: 5.2 } },
  chest_l: { photo: "front", rect: { x: 52.6, y: 13.8, w: 8.2, h: 5.0 } },
  chest_r: { photo: "front", rect: { x: 38.8, y: 13.8, w: 8.2, h: 5.0 } },
  abs: { photo: "front", rect: { x: 43.8, y: 21.8, w: 12.4, h: 9.2 } },
  bicep_l: { photo: "front", rect: { x: 64.2, y: 18.4, w: 5.4, h: 7.0 } },
  bicep_r: { photo: "front", rect: { x: 30.2, y: 18.4, w: 5.6, h: 7.2 } },
  forearm_l: { photo: "front", rect: { x: 65.6, y: 26.2, w: 5.2, h: 8.0 } },
  forearm_r: { photo: "front", rect: { x: 28.8, y: 26.2, w: 5.2, h: 8.0 } },
  thigh_l: { photo: "front", rect: { x: 58.6, y: 49.3, w: 5.6, h: 6.4 } },
  thigh_r: { photo: "front", rect: { x: 36.5, y: 49.6, w: 5.8, h: 6.2 } },
  back_l: { photo: "back", rect: { x: 38.8, y: 17.2, w: 8.4, h: 8.8 } },
  back_r: { photo: "back", rect: { x: 52.4, y: 17.3, w: 8.6, h: 8.8 } },
};

export function zonePlacement(name: ZoneName) {
  return ZONE_PHOTOS[name];
}

export function zonesOnPhoto(side: ZonePhotoSide) {
  return ZONE_NAMES.filter((name) => ZONE_PHOTOS[name].photo === side);
}

export function rectCenter(rect: ZoneRect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
