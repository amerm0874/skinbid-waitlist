import { readFileSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const HANDLE = "mmohamedamerrr";
const GLB_PATH = path.join(process.cwd(), "public", "avatar-male.glb");
const ZONE_NAMES = [
  "chest_l",
  "chest_r",
  "abs",
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
];

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
}

function supabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

function normalizeHandle(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 48);
}

function handleFromSocial(social) {
  const raw = social?.trim() ?? "";
  if (!raw) {
    return null;
  }
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (url.hostname.includes(".")) {
      const first = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
      if (first) {
        return normalizeHandle(first);
      }
    }
  } catch {
    // Plain handle.
  }
  return normalizeHandle(raw) || null;
}

function slugFromName(name) {
  return (
    (name ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || null
  );
}

function publicHandle(profile) {
  return handleFromSocial(profile.social) || slugFromName(profile.name);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const url = supabaseUrl();
const key = supabaseServiceKey();
if (!url || !key) {
  fail("Need SUPABASE_URL and a service role key.");
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: profiles, error: profileError } = await admin
  .from("profiles")
  .select("id, name, role, social, sport, sport_detail, country");
if (profileError) {
  fail(`Profiles failed: ${profileError.message}`);
}

const athlete = (profiles ?? []).find(
  (row) => row.role === "athlete" && publicHandle(row) === HANDLE,
);
if (!athlete) {
  const athletes = (profiles ?? [])
    .filter((row) => row.role === "athlete")
    .map((row) => `${publicHandle(row) || "no-handle"} (${row.name || "unnamed"})`);
  fail(`No athlete ${HANDLE}. Athletes: ${athletes.join(", ") || "none"}`);
}

const bytes = readFileSync(GLB_PATH);
if (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "glTF") {
  fail("public/avatar-male.glb is not a GLB.");
}

const storagePath = `${athlete.id}/avatar.glb`;
const { error: uploadError } = await admin.storage.from("avatars").upload(storagePath, bytes, {
  upsert: true,
  contentType: "model/gltf-binary",
  cacheControl: "3600",
});
if (uploadError) {
  fail(`GLB upload failed: ${uploadError.message}`);
}

const publicUrl = admin.storage.from("avatars").getPublicUrl(storagePath).data.publicUrl;
const glbUrl = `${publicUrl}?v=${Date.now()}`;
if (/avatar-male\.glb|placeholder\.glb/i.test(glbUrl)) {
  fail("Copied GLB URL still looks like the landing file.");
}

const { error: avatarError } = await admin.from("avatars").upsert({
  athlete_id: athlete.id,
  glb_url: glbUrl,
  ready: true,
});
if (avatarError) {
  fail(`Avatar upsert failed: ${avatarError.message}`);
}

const { data: avatar } = await admin
  .from("avatars")
  .select("ready, glb_url")
  .eq("athlete_id", athlete.id)
  .maybeSingle();
if (!avatar?.ready || !avatar.glb_url || /placeholder\.glb|avatar-male\.glb/i.test(avatar.glb_url)) {
  fail("Avatar is not ready with a copied body.");
}

const { data: captures } = await admin
  .from("captures")
  .select("id, status, model_paid")
  .eq("athlete_id", athlete.id)
  .order("created_at", { ascending: false });

const latest = captures?.[0];
if (latest) {
  const { error } = await admin
    .from("captures")
    .update({
      status: "ready",
      model_paid: true,
    })
    .eq("id", latest.id);
  if (error) {
    fail(`Capture update failed: ${error.message}`);
  }
} else {
  const { error } = await admin.from("captures").insert({
    athlete_id: athlete.id,
    paths: [],
    status: "ready",
    model_paid: true,
  });
  if (error) {
    fail(`Capture insert failed: ${error.message}`);
  }
}

const { data: events } = await admin
  .from("events")
  .select("id, slug, status, name, date, city, country, sport")
  .eq("athlete_id", athlete.id)
  .order("created_at", { ascending: false });

const active = (events ?? []).find((row) => row.status === "live" || row.status === "draft");
const eventDate = new Date();
eventDate.setDate(eventDate.getDate() + 14);
eventDate.setHours(9, 0, 0, 0);

const eventFields = {
  name: active?.name?.trim() || "HYROX Test",
  date: active?.date || eventDate.toISOString(),
  city: active?.city || "Lisbon",
  country: active?.country || athlete.country || "Portugal",
  sport: active?.sport || athlete.sport || "HYROX",
  sport_detail: athlete.sport_detail ?? null,
  slug: active?.slug || "mohamed-test",
  likeness_opt_in: true,
  offer_tattoo: true,
  offer_sticker: true,
};

let eventId = active?.id ?? null;
let eventSlug = eventFields.slug;

if (active) {
  const { data: updated, error } = await admin
    .from("events")
    .update({
      ...eventFields,
      status: "live",
    })
    .eq("id", active.id)
    .select("id, slug, status")
    .single();
  if (error || !updated || updated.status !== "live") {
    fail(`Event live update failed: ${error?.message || updated?.status || "unknown"}`);
  }
  eventId = updated.id;
  eventSlug = updated.slug;
} else {
  const { data: created, error } = await admin
    .from("events")
    .insert({
      athlete_id: athlete.id,
      ...eventFields,
      status: "live",
    })
    .select("id, slug, status")
    .single();
  if (error || !created || created.status !== "live") {
    fail(`Event insert failed: ${error?.message || created?.status || "unknown"}`);
  }
  eventId = created.id;
  eventSlug = created.slug;
}

const { data: zoneRows } = await admin
  .from("zones")
  .select("name")
  .eq("event_id", eventId);
const have = new Set((zoneRows ?? []).map((row) => row.name));
const missing = ZONE_NAMES.filter((name) => !have.has(name)).map((name) => ({
  event_id: eventId,
  name,
  status: "open",
}));
if (missing.length) {
  const { error } = await admin.from("zones").insert(missing);
  if (error) {
    fail(`Zone insert failed: ${error.message}`);
  }
}

const { data: stillAvatar } = await admin
  .from("avatars")
  .select("ready, glb_url")
  .eq("athlete_id", athlete.id)
  .maybeSingle();
const { data: stillEvent } = await admin
  .from("events")
  .select("slug, status")
  .eq("id", eventId)
  .maybeSingle();
const { data: stillCapture } = await admin
  .from("captures")
  .select("status, model_paid")
  .eq("athlete_id", athlete.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

console.log("athlete", HANDLE, athlete.name);
console.log("glb_copied", Boolean(stillAvatar?.ready));
console.log("capture", stillCapture?.status, "paid", stillCapture?.model_paid);
console.log("event", stillEvent?.slug, stillEvent?.status);
console.log("path", `/e/${eventSlug}`);
