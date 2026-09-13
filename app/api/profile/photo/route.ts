import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { publicAthleteHandle } from "@/lib/handle";
import { takeToken } from "@/lib/rate-limit";

function looksLikePhotoUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

export async function PATCH(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (!profile || profile.role !== "athlete") {
    return NextResponse.json({ error: "Athletes only." }, { status: 403 });
  }
  if (!takeToken(`profile-photo:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many saves. Wait a minute." },
      { status: 429 },
    );
  }

  let body: { photo_url?: unknown } = {};
  try {
    body = (await request.json()) as { photo_url?: unknown };
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  if (!looksLikePhotoUrl(body.photo_url)) {
    return NextResponse.json({ error: "Bad photo URL." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ photo_url: body.photo_url })
    .eq("id", user.id);
  if (error) {
    console.log("Avatar save failed", error.message);
    return NextResponse.json({ error: "Could not save photo." }, { status: 500 });
  }

  revalidatePath("/me");
  const handle = publicAthleteHandle(profile);
  if (handle) {
    revalidatePath(`/a/${handle}`);
  }
  console.log("Avatar saved", user.id);
  return NextResponse.json({ ok: true });
}
