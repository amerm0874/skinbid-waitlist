import { createBrowserSupabase } from "@/lib/supabase/client";

export const CAPTURES_BUCKET = "captures";
export const ORBIT_MIN_SECONDS = 45;
export const PROFILE_CLIP_MIN_SECONDS = 5;
export const PROFILE_CLIP_MAX_SECONDS = 10;
export const MAX_ORBIT_VIDEO_BYTES = 512 * 1024 * 1024;
export const MAX_PROFILE_CLIP_BYTES = 80 * 1024 * 1024;
export const MAX_NAME_CLIP_BYTES = MAX_PROFILE_CLIP_BYTES;

export const CAPTURE_TITLE = "Scan your body";
export const PLACEHOLDER_GLB = "/placeholder.glb";
export const PAY_MODEL_LABEL = "Pay $50 — 3D model";
export const PROFILE_CLIP_LABEL = "Profile clip";
export const ORBIT_CLIP_LABEL = "Orbit clip";
export const UPLOAD_PROFILE_LABEL = "Upload profile clip";
export const UPLOAD_ORBIT_LABEL = "Upload orbit clip";

export const CAPTURE_STEPS = [
  "Indoor, two lights or two windows. No harsh sun.",
  "Tight race kit. Hair tied.",
  "Orbit clip: 60–90s slow circle, phone at chest, hair to mid-shin.",
  "Profile clip: 5–10s, face + chest. This plays on your page.",
  "Upload those two files. We build the 3D body by hand. Until it is ready, bidding is not public.",
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
    return "Upload one orbit clip.";
  }
  const video = files[0];
  if (!isVideoFile(video)) {
    return "Orbit clip must be an mp4 or mov.";
  }
  if (video.size > MAX_ORBIT_VIDEO_BYTES) {
    return "Orbit clip must be under 512 MB.";
  }
  const seconds = await readVideoDuration(video);
  if (seconds !== null && seconds < ORBIT_MIN_SECONDS) {
    return "Orbit clip is under 45 seconds. Record 60–90s.";
  }
  return "";
}

export async function profileClipFileError(file: File | null) {
  if (!file) {
    return "";
  }
  if (!isVideoFile(file)) {
    return "Profile clip must be an mp4 or mov.";
  }
  if (file.size > MAX_PROFILE_CLIP_BYTES) {
    return "Profile clip must be under 80 MB.";
  }
  const seconds = await readVideoDuration(file);
  if (seconds !== null && seconds < PROFILE_CLIP_MIN_SECONDS) {
    return "Profile clip is under 5 seconds. Record 5–10s.";
  }
  if (seconds !== null && seconds > PROFILE_CLIP_MAX_SECONDS) {
    return "Profile clip is over 10 seconds. Keep it 5–10s.";
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
    return "Add the orbit clip.";
  }
  if (!nameClip) {
    return "Add the profile clip.";
  }
  const orbitReason = await orbitFileError(orbitFiles);
  if (orbitReason) {
    return orbitReason;
  }
  return profileClipFileError(nameClip);
}

export function isOrbitClipPath(path: string) {
  return path.includes("/orbit.");
}

export function isProfileClipPath(path: string) {
  return /\/(profile|name)\./i.test(path);
}

export function profileClipPathFrom(paths: unknown) {
  if (!Array.isArray(paths)) {
    return null;
  }
  return (
    paths.find(
      (path): path is string => typeof path === "string" && isProfileClipPath(path),
    ) ?? null
  );
}

function existingPaths(paths: unknown) {
  return Array.isArray(paths)
    ? paths.filter((path): path is string => typeof path === "string")
    : [];
}

function mergeCapturePaths(
  paths: unknown,
  nextPath: string,
  kind: "orbit" | "profile",
) {
  const drop =
    kind === "orbit"
      ? isOrbitClipPath
      : isProfileClipPath;
  return [nextPath, ...existingPaths(paths).filter((path) => !drop(path))];
}

async function uploadObject(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>,
  path: string,
  file: File,
  contentType: string,
) {
  const { error } = await supabase.storage.from(CAPTURES_BUCKET).upload(path, file, {
    upsert: true,
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

  const { data: paid } = await supabase
    .from("captures")
    .select("id, model_paid")
    .eq("athlete_id", userId)
    .eq("model_paid", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!paid?.id) {
    throw new Error("Pay $50 for the 3D model first.");
  }

  const captureId = paid.id as string;
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
      `${userId}/${captureId}/profile.${fileExt(nameClip, "mp4")}`,
      nameClip,
      nameClip.type || "video/mp4",
    ),
  ];

  const { error } = await supabase
    .from("captures")
    .update({
      paths,
      status: "uploaded",
    })
    .eq("id", captureId)
    .eq("athlete_id", userId);
  if (error) {
    throw error;
  }

  console.log("Capture uploaded", paths.length);
  return paths;
}

async function loadPaidCapture(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>,
  userId: string,
) {
  const { data: paid } = await supabase
    .from("captures")
    .select("id, model_paid, paths")
    .eq("athlete_id", userId)
    .eq("model_paid", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return paid;
}

export async function uploadOrbitVideo(userId: string, orbitFile: File) {
  const reason = await orbitFileError([orbitFile]);
  if (reason) {
    throw new Error(reason);
  }

  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }

  const paid = await loadPaidCapture(supabase, userId);
  if (!paid?.id) {
    throw new Error("Pay $50 for the 3D model first.");
  }

  const captureId = paid.id as string;
  const orbitPath = await uploadObject(
    supabase,
    `${userId}/${captureId}/orbit.${fileExt(orbitFile, "mp4")}`,
    orbitFile,
    orbitFile.type || "video/mp4",
  );
  const paths = mergeCapturePaths(paid.paths, orbitPath, "orbit");

  const { error } = await supabase
    .from("captures")
    .update({
      paths,
      status: "uploaded",
    })
    .eq("id", captureId)
    .eq("athlete_id", userId);
  if (error) {
    throw error;
  }

  console.log("Orbit uploaded", orbitPath);
  return paths;
}

export async function uploadProfileClip(userId: string, profileFile: File) {
  const reason = await profileClipFileError(profileFile);
  if (reason) {
    throw new Error(reason);
  }

  const supabase = createBrowserSupabase();
  if (!supabase) {
    throw new Error("Auth is not configured yet.");
  }

  const paid = await loadPaidCapture(supabase, userId);
  if (!paid?.id) {
    throw new Error("Pay $50 for the 3D model first.");
  }

  const captureId = paid.id as string;
  const profilePath = await uploadObject(
    supabase,
    `${userId}/${captureId}/profile.${fileExt(profileFile, "mp4")}`,
    profileFile,
    profileFile.type || "video/mp4",
  );
  const paths = mergeCapturePaths(paid.paths, profilePath, "profile");

  const { error } = await supabase
    .from("captures")
    .update({
      paths,
      status: "uploaded",
    })
    .eq("id", captureId)
    .eq("athlete_id", userId);
  if (error) {
    throw error;
  }

  console.log("Profile clip uploaded", profilePath);
  return paths;
}
