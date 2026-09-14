import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isMissingRelation } from "@/lib/db-error";
import { isNoticeHref, listNotices } from "@/lib/notifications";

export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const items = await listNotices(supabase, user.id);
  if (!items) {
    return NextResponse.json({ error: "Could not load notices." }, { status: 500 });
  }

  return NextResponse.json({
    items,
    unread: items.filter((item) => !item.read_at).length,
  });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  let body: { id?: string } = {};
  try {
    body = (await request.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: "Bad notice payload." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Need a notice." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, href")
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error, "notifications")) {
      return NextResponse.json({ error: "Notices are not set up." }, { status: 503 });
    }
    console.log("Notice mark-read failed", error.message);
    return NextResponse.json({ error: "Could not mark as read." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Notice not found." }, { status: 404 });
  }

  const href = isNoticeHref(data.href) ? data.href : "/events";
  return NextResponse.json({ ok: true, href });
}
