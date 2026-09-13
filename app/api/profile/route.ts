import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbErrorFields, dbErrorMessage } from "@/lib/db-error";
import { publicAthleteHandle } from "@/lib/handle";
import { saveSessionProfile, type ProfileBody } from "@/lib/profile";
import { takeToken } from "@/lib/rate-limit";
import { filledSocialAccounts, parseSocialAccounts, socialUrl } from "@/lib/socials";

function fail(error: unknown, status: number) {
  return NextResponse.json(
    { error: dbErrorMessage(error), ...dbErrorFields(error) },
    { status },
  );
}

async function save(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (!takeToken(`profile:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many saves. Wait a minute." },
      { status: 429 },
    );
  }

  let body: ProfileBody = {};
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Bad profile payload." }, { status: 400 });
  }

  const result = await saveSessionProfile(supabase, user.id, profile, body);
  if (!result.ok) {
    return fail(result.error, result.status);
  }

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  revalidatePath("/me");
  revalidatePath("/new");
  if (profile?.role === "athlete") {
    revalidatePath("/a/[handle]", "page");
    const accounts = filledSocialAccounts(
      parseSocialAccounts(body.socials, profile.social),
    );
    const nextSocial = accounts[0]
      ? socialUrl(accounts[0].network, accounts[0].handle)
      : (profile.social ?? null);
    const handles = [
      publicAthleteHandle(profile),
      publicAthleteHandle({
        social: nextSocial,
        name: typeof body.name === "string" ? body.name : profile.name,
      }),
    ].filter((handle): handle is string => Boolean(handle));
    for (const handle of handles) {
      revalidatePath(`/a/${handle}`);
    }
  }
  console.log("Profile saved", user.id);
  return NextResponse.json({ ok: true, next: result.next });
}

export async function POST(request: Request) {
  return save(request);
}

export async function PATCH(request: Request) {
  return save(request);
}
