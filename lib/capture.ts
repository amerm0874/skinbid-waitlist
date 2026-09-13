import { createBrowserSupabase } from "@/lib/supabase/client";

export const CAPTURES_BUCKET = "captures";
export const ORBIT_MIN_SECONDS = 45;
export const MAX_ORBIT_VIDEO_BYTES = 512 * 1024 * 1024;
export const MAX_NAME_CLIP_BYTES = 80 * 1024 * 1024;

export const CAPTURE_TITLE = "Scan your body";

export const CAPTURE_STEPS = [
  "Indoor, two lights or two windows. No harsh sun.",
  "Tight race kit. Hair tied.",
  "Orbit 60–90s, phone at chest height, hair to mid-shin, arms slightly off the body.",
  "Then a 10s clip: face + chest, say your display name.",
  "Upload those files here. We build the GLB. Event stays draft until the GLB is ready.",
];

export const CAPTURE_VIDEO_ACCEPT = ".mp4,.mov,video/mp4,video/quicktime";

export function isVideoFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4") || name.endsWith(".mov")) {
    return true;
  }
  return file.type === "video/mp4" || file.type === "video/quicktime";
}

function fileExt(file: File, fallback: string) {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }
  return fallback;
}

// Duration is only a reject when the browser can read it and it is clearly short.
export function readVideoDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const finish = (value: number | null) => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => {
      const duration = video.duration;
      finish(Number.isFinite(duration) ? duration : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export async function orbitFileError(files: File[]) {
  if (files.length === 0) {
    return "";
  }
  if (files.length > 1) {
    return "Upload one orbit video.";
  }
  const video = files[0];
  if (!isVideoFile(video)) {
    return "Orbit must be an mp4 or mov.";
  }
  if (video.size > MAX_ORBIT_VIDEO_BYTES) {
    return "Orbit video must be under 512 MB.";
  }
  const seconds = await readVideoDuration(video);
  if (seconds !== null && seconds < ORBIT_MIN_SECONDS) {
    return "Orbit is under 45 seconds. Record 60–90s.";
  }
  return "";
}

export function nameClipFileError(file: File | null) {
  if (!file) {
    return "";
  }
  if (!isVideoFile(file)) {
    return "Name clip must be an mp4 or mov.";
  }
  if (file.size > MAX_NAME_CLIP_BYTES) {
    return "Name clip must be under 80 MB.";
  }
  return "";
}

export async function captureFilesError(
  orbitFiles: File[],
  nameClip: File | null,
) {
  if (orbitFiles.length === 0 && !nameClip) {
    return "";
  }
  if (orbitFiles.length === 0) {
    return "Add the orbit video.";
  }
  if (!nameClip) {
    return "Add the 10s name clip.";
  }
  const orbitReason = await orbitFileError(orbitFiles);
  if (orbitReason) {
    return orbitReason;
  }
  return nameClipFileError(nameClip);
}

async function uploadObject(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>,
  path: string,
  file: File,
  contentType: string,
) {
  const { error } = await supabase.storage.from(CAPTURES_BUCKET).upload(path, file, {
    upsert: false,
    contentType,
  });
  if (error) {
    throw error;
  }
  return path;
}

// Store the raw scan only. Do not reconstruct a mesh. Do not set avatars.ready.
export async function uploadCapture(
  userId: string,
  orbitFiles: File[],
  nameClip: File,
) {
  const reason = await captureFilesError(orbitFiles, nameClip);
  if (reason) {
    throw new Error(reason);
  }

  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }

  const captureId = crypto.randomUUID();
  const orbit = orbitFiles[0];
  const paths = [
    await uploadObject(
      supabase,
      `${userId}/${captureId}/orbit.${fileExt(orbit, "mp4")}`,
      orbit,
      orbit.type || "video/mp4",
    ),
    await uploadObject(
      supabase,
      `${userId}/${captureId}/name.${fileExt(nameClip, "mp4")}`,
      nameClip,
      nameClip.type || "video/mp4",
    ),
  ];

  const { error } = await supabase.from("captures").insert({
    athlete_id: userId,
    paths,
    status: "uploaded",
  });
  if (error) {
    throw error;
  }

  console.log("Capture uploaded", paths.length);
  return paths;
}
