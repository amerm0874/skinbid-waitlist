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
  if (profile?.role !== "athlete" && profile?.role !== "brand") {
    return NextResponse.json({ error: "Profile photo needs a role." }, { status: 403 });
  }
  if (!takeToken(`profile-photo:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many saves. Wait a minute." },
      { status: 429 },
    );
  }

  let body: { photo_url?: unknown; logo_url?: unknown } = {};
  try {
    body = (await request.json()) as { photo_url?: unknown; logo_url?: unknown };
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  const isBrand = profile.role === "brand";
  const nextUrl = isBrand ? body.logo_url : body.photo_url;
  if (!looksLikePhotoUrl(nextUrl)) {
    return NextResponse.json({ error: "Bad photo URL." }, { status: 400 });
  }

  const patch = isBrand ? { logo_url: nextUrl } : { photo_url: nextUrl };
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    console.log("Avatar save failed", error.message);
    return NextResponse.json({ error: "Could not save photo." }, { status: 500 });
  }

  revalidatePath("/me");
  revalidatePath("/events");
  const handle = publicAthleteHandle(profile);
  if (handle) {
    revalidatePath(`/a/${handle}`);
  }
  console.log("Avatar saved", user.id, profile.role);
  return NextResponse.json({ ok: true });
}
