import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { athleteOnboardingComplete } from "@/lib/config";
import { CANCEL_BLOCKED, eventHasHeldOrWonBid } from "@/lib/event-cancel";
import { publicAthleteHandle } from "@/lib/handle";

type Body = {
  id?: string;
};

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete" || !athleteOnboardingComplete(profile)) {
    return NextResponse.json(
      { error: "Finish athlete payout details first." },
      { status: 403 },
    );
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Need an event." }, { status: 400 });
  }

  const eventId = body.id?.trim() ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "Need an event." }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, slug, status")
    .eq("id", eventId)
    .eq("athlete_id", user.id)
    .in("status", ["draft", "live"])
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "No event to cancel." }, { status: 400 });
  }

  if (await eventHasHeldOrWonBid(supabase, event.id)) {
    return NextResponse.json({ error: CANCEL_BLOCKED }, { status: 409 });
  }

  const { data: updated, error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", event.id)
    .eq("athlete_id", user.id)
    .in("status", ["draft", "live"])
    .select("slug, status")
    .maybeSingle();

  if (error || !updated || updated.status !== "cancelled") {
    console.log("Event cancel failed", error?.message);
    return NextResponse.json({ error: "Could not cancel." }, { status: 500 });
  }

  if (await eventHasHeldOrWonBid(supabase, event.id)) {
    await supabase
      .from("events")
      .update({ status: event.status })
      .eq("id", event.id)
      .eq("athlete_id", user.id)
      .eq("status", "cancelled");
    return NextResponse.json({ error: CANCEL_BLOCKED }, { status: 409 });
  }

  console.log("Event cancelled", updated.slug);
  revalidatePath("/me");
  revalidatePath("/events");
  revalidatePath(`/e/${updated.slug}`);
  revalidatePath("/e/[slug]", "page");
  const handle = publicAthleteHandle(profile);
  if (handle) {
    revalidatePath(`/a/${handle}`);
  }
  return NextResponse.json({ slug: updated.slug, status: "cancelled" });
}
