// One place for the landing hero, posters, and 3D files.
// Bump MODEL_CACHE when a .glb changes so browsers do not keep an old copy.
export const MODEL_CACHE = "10";

export const MODEL_SRC = {
  male: `/avatar-male.glb?v=${MODEL_CACHE}`,
  female: `/avatar-female.glb?v=${MODEL_CACHE}`,
} as const;

export const POSTER_SRC = {
  male: "/poster-male.webp",
  female: "/poster-female.webp",
} as const;

export const HERO_SRC = "/hero-slots.webp";
export const HERO_WIDTH = 960;
export const HERO_HEIGHT = 1074;

export const DRACO_PATH = "/draco/";
export const DRACO_WASM = "/draco/draco_decoder.wasm";
export const DRACO_WRAPPER = "/draco/draco_wasm_wrapper.js";
