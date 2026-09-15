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

// public/body/front.jpg 1152x1728, back.jpg 784x1168.
// Full-body crop (head to shin, short shorts). L/R = athlete left/right:
// FRONT athlete-left is viewer-right; BACK athlete-left is viewer-left.
export const ZONE_PHOTOS: Record<ZoneName, ZonePlacement> = {
  shoulder_r: { photo: "front", rect: { x: 29.6, y: 24.8, w: 7.0, h: 4.2 } },
  shoulder_l: { photo: "front", rect: { x: 63.4, y: 24.8, w: 7.0, h: 4.2 } },
  chest_r: { photo: "front", rect: { x: 39.6, y: 30.6, w: 8.4, h: 5.4 } },
  chest_l: { photo: "front", rect: { x: 52.0, y: 30.6, w: 8.4, h: 5.4 } },
  abs: { photo: "front", rect: { x: 44.8, y: 42.4, w: 10.4, h: 6.6 } },
  bicep_r: { photo: "front", rect: { x: 27.0, y: 30.4, w: 5.4, h: 7.4 } },
  bicep_l: { photo: "front", rect: { x: 67.6, y: 30.4, w: 5.4, h: 7.4 } },
  forearm_r: { photo: "front", rect: { x: 22.8, y: 41.6, w: 5.0, h: 7.2 } },
  forearm_l: { photo: "front", rect: { x: 72.2, y: 41.6, w: 5.0, h: 7.2 } },
  thigh_r: { photo: "front", rect: { x: 40.2, y: 69.0, w: 7.4, h: 8.2 } },
  thigh_l: { photo: "front", rect: { x: 52.4, y: 69.0, w: 7.4, h: 8.2 } },
  back_l: { photo: "back", rect: { x: 37.8, y: 33.2, w: 10.0, h: 11.8 } },
  back_r: { photo: "back", rect: { x: 52.2, y: 33.2, w: 10.0, h: 11.8 } },
};

// ZOOM with no zone: step in on the torso, not a pec crop from y=0.
export const TORSO_FOCUS: Record<ZonePhotoSide, { x: number; y: number }> = {
  front: { x: 50, y: 38 },
  back: { x: 50, y: 34 },
};

// Leave the ids in ZONE_NAMES / ZONE_PHOTOS. Do not guess new shoulder rects.
export const HIDDEN_PHOTO_ZONES: ReadonlySet<ZoneName> = new Set([
  "shoulder_l",
  "shoulder_r",
]);

export function isHiddenPhotoZone(name: ZoneName) {
  return HIDDEN_PHOTO_ZONES.has(name);
}

export function zonePhotoSide(name: ZoneName): ZonePhotoSide {
  return ZONE_PHOTOS[name].photo;
}

export function zonePlacement(
  name: ZoneName,
  saved?: Partial<Record<ZoneName, ZoneRect>> | null,
): ZonePlacement {
  const fallback = ZONE_PHOTOS[name];
  const rect = saved?.[name];
  return rect ? { photo: fallback.photo, rect } : fallback;
}

export function zonesOnPhoto(side: ZonePhotoSide) {
  return ZONE_NAMES.filter((name) => ZONE_PHOTOS[name].photo === side);
}

export function drawnPhotoZones(
  side: ZonePhotoSide,
  input: {
    saved?: Partial<Record<ZoneName, ZoneRect>> | null;
    closed?: ReadonlySet<ZoneName>;
    savedOnly?: boolean;
  } = {},
) {
  return zonesOnPhoto(side).filter((name) => {
    if (isHiddenPhotoZone(name)) {
      return false;
    }
    if (input.closed?.has(name)) {
      return false;
    }
    if (input.savedOnly) {
      return Boolean(input.saved?.[name]);
    }
    return Boolean(zonePlacement(name, input.saved).rect);
  });
}

export function rectCenter(rect: ZoneRect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}
