import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser, isAdminEmail } from "@/lib/auth";
import { DEMO_SLUG } from "@/lib/demo-event";
import { isReadyAvatar } from "@/lib/event-create";
import { AVATARS_BUCKET, avatarGlbPath, glbFileError } from "@/lib/glb";
import { takeToken } from "@/lib/rate-limit";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Body = {
  action?: "sign" | "publish";
  event_id?: string;
  name?: string;
  size?: number;
};

// Admin drops in a finished .glb. Do not run photogrammetry here.
export async function POST(request: Request) {
  const { user } = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Service role key missing." }, { status: 503 });
  }

  if (!takeToken(`admin-glb:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many uploads. Wait a minute." }, { status: 429 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  const eventId = body.event_id?.trim() ?? "";
  if (!eventId || (body.action !== "sign" && body.action !== "publish")) {
    return NextResponse.json({ error: "Need a draft event and an action." }, { status: 400 });
  }

  const { data: event } = await admin
    .from("events")
    .select("id, athlete_id, slug, status, name")
    .eq("id", eventId)
    .maybeSingle();

  if (!event || event.slug === DEMO_SLUG) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.status !== "draft") {
    return NextResponse.json({ error: "Only draft events take a ready GLB." }, { status: 409 });
  }

  const path = avatarGlbPath(event.athlete_id);

  if (body.action === "sign") {
    const reason = glbFileError({
      name: body.name ?? "",
      size: typeof body.size === "number" ? body.size : 0,
    });
    if (reason) {
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    await admin.storage.from(AVATARS_BUCKET).remove([path]);
    const { data: signed, error: signError } = await admin.storage
      .from(AVATARS_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });
    if (signError || !signed?.token || !signed.path) {
      console.log("Admin GLB sign failed", signError?.message);
      return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
    }

    return NextResponse.json({
      path: signed.path,
      token: signed.token,
    });
  }

  const { error: missing } = await admin.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, 30);
  if (missing) {
    return NextResponse.json({ error: "Upload the .glb first." }, { status: 400 });
  }

  const publicUrl = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path).data
    .publicUrl;
  const glbUrl = `${publicUrl}?v=${Date.now()}`;
  if (!isReadyAvatar({ ready: true, glb_url: glbUrl })) {
    return NextResponse.json({ error: "placeholder.glb does not count." }, { status: 400 });
  }

  const { error: avatarError } = await admin.from("avatars").upsert({
    athlete_id: event.athlete_id,
    glb_url: glbUrl,
    ready: true,
  });
  if (avatarError) {
    console.log("Admin avatar ready failed", avatarError.message);
    return NextResponse.json({ error: "Could not mark the body ready." }, { status: 500 });
  }

  const { data: avatar } = await admin
    .from("avatars")
    .select("ready, glb_url")
    .eq("athlete_id", event.athlete_id)
    .maybeSingle();
  if (!isReadyAvatar(avatar)) {
    return NextResponse.json({ error: "Scan required." }, { status: 400 });
  }

  const { data: live, error: liveError } = await admin
    .from("events")
    .update({ status: "live" })
    .eq("id", event.id)
    .eq("status", "draft")
    .select("slug, status")
    .single();

  if (liveError || !live || live.status !== "live") {
    console.log("Admin publish failed", liveError?.message);
    return NextResponse.json(
      { error: "Could not take the event live.", slug: event.slug, status: "draft" },
      { status: 400 },
    );
  }

  const { data: still } = await admin
    .from("avatars")
    .select("ready, glb_url")
    .eq("athlete_id", event.athlete_id)
    .maybeSingle();
  if (!isReadyAvatar(still)) {
    await admin
      .from("events")
      .update({ status: "draft" })
      .eq("id", event.id)
      .eq("status", "live");
    return NextResponse.json(
      { error: "Scan required.", slug: event.slug, status: "draft" },
      { status: 400 },
    );
  }

  console.log("Admin marked GLB ready", live.slug);
  revalidatePath("/admin");
  revalidatePath("/new");
  revalidatePath("/events");
  revalidatePath(`/e/${live.slug}`);
  revalidatePath("/e/[slug]", "page");
  return NextResponse.json({ slug: live.slug, status: "live" });
}
