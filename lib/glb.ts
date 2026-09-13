export const AVATARS_BUCKET = "avatars";
export const MAX_GLB_BYTES = 80 * 1024 * 1024;

export function avatarGlbPath(athleteId: string) {
  return `${athleteId}/avatar.glb`;
}

export function glbFileError(file: { name: string; size: number }) {
  const name = file.name.toLowerCase().trim();
  if (!name.endsWith(".glb")) {
    return "Upload a .glb file.";
  }
  if (name.includes("placeholder.glb")) {
    return "placeholder.glb does not count.";
  }
  if (file.size <= 0) {
    return "Upload a .glb file.";
  }
  if (file.size > MAX_GLB_BYTES) {
    return "The .glb must be under 80 MB.";
  }
  return "";
}

export function isGlbMagic(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return (
    view.length >= 4 &&
    view[0] === 0x67 &&
    view[1] === 0x6c &&
    view[2] === 0x54 &&
    view[3] === 0x46
  );
}
