import { LOGOS_BUCKET } from "@/lib/logo";
import { createBrowserSupabase } from "@/lib/supabase/client";

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTOS_BUCKET = "photos";
export const PHOTO_SIZE = 800;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const AVATAR_SIZE = 512;

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPhotoFile(file: { type: string; name: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png")
  );
}

export function isPngPhoto(file: { type: string; name: string }) {
  return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

export function isJpegBytes(bytes: Uint8Array) {
  if (bytes.length < JPEG_SIGNATURE.length) {
    return false;
  }
  return JPEG_SIGNATURE.every((value, index) => bytes[index] === value);
}

export function isPngBytes(bytes: Uint8Array) {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false;
  }
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

export function photoClientError(file: File | null) {
  if (!file) {
    return "Add a JPG or PNG photo.";
  }
  if (!isPhotoFile(file)) {
    return "Photo must be a JPG or PNG.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "Photo must be under 2 MB.";
  }
  return "";
}

export function isAvatarFile(file: { type: string; name: string }) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    isPhotoFile(file) ||
    type === "image/webp" ||
    name.endsWith(".webp")
  );
}

export function avatarClientError(file: File | null) {
  if (!file) {
    return "Add a JPG, PNG, or WEBP photo.";
  }
  if (!isAvatarFile(file)) {
    return "Photo must be a JPG, PNG, or WEBP.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "Photo must be under 5 MB.";
  }
  return "";
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo."));
    };
    image.src = url;
  });
}

export async function squarePhotoFile(file: File) {
  const invalid = photoClientError(file);
  if (invalid) {
    throw new Error(invalid);
  }
  const image = await loadImage(file);
  const side = Math.min(image.width, image.height);
  if (side < 64) {
    throw new Error("Photo is too small.");
  }
  const size = Math.min(PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not crop that photo.");
  }
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;
  ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);

  const png = isPngPhoto(file);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) {
          resolve(next);
          return;
        }
        reject(new Error("Could not crop that photo."));
      },
      png ? "image/png" : "image/jpeg",
      png ? undefined : 0.9,
    );
  });
  const name = png ? "photo.png" : "photo.jpg";
  return new File([blob], name, { type: blob.type });
}

export async function squareAvatarWebp(file: File) {
  const invalid = avatarClientError(file);
  if (invalid) {
    throw new Error(invalid);
  }
  const image = await loadImage(file);
  const side = Math.min(image.width, image.height);
  if (side < 64) {
    throw new Error("Photo is too small.");
  }
  const size = Math.min(AVATAR_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not crop that photo.");
  }
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;
  ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) {
          resolve(next);
          return;
        }
        reject(new Error("Could not crop that photo."));
      },
      "image/webp",
      0.9,
    );
  });
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

// Reuses the existing public `photos` bucket (already RLS'd for per-user
// paths + public read) instead of a new "avatars" bucket, since that name
// is already taken by the athlete's GLB body-model bucket.
export async function uploadAvatarPhoto(userId: string, file: File) {
  const square = await squareAvatarWebp(file);
  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }
  const path = `${userId}/avatar.webp`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, square, {
    upsert: true,
    contentType: "image/webp",
  });
  if (error) {
    throw error;
  }
  const publicUrl = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}

export async function uploadProfilePhoto(userId: string, file: File) {
  const square = await squarePhotoFile(file);
  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }
  const path = `${userId}/${Date.now()}-${square.name}`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, square, {
    upsert: true,
    contentType: square.type,
  });
  const uploaded = error
    ? await supabase.storage.from(LOGOS_BUCKET).upload(path, square, {
        upsert: true,
        contentType: square.type,
      })
    : { error: null };
  if (uploaded.error) {
    throw uploaded.error;
  }
  const bucket = error ? LOGOS_BUCKET : PHOTOS_BUCKET;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}
