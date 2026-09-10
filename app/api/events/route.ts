import { NextResponse } from "next/server";
import { eventDateWindowError, slugify } from "@/lib/auction";
import { getSessionUser } from "@/lib/auth";
import { ZONE_NAMES, isZoneName } from "@/lib/zones";

type Body = {
  name?: string;
  date?: string;
  city?: string;
  sport?: string;
  likeness_opt_in?: boolean;
  appearance_price_cents?: number | null;
  zones?: Record<string, "open" | "closed">;
};

export async function POST(request: Request) {
  const { supabase, user, profile } = await getSessionUser();
  if (!supabase || !user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete") {
    return NextResponse.json({ error: "Athletes list events." }, { status: 403 });
  }

  const body = (await request.json()) as Body;
  const name = (body.name ?? "").trim();
  const date = body.date ?? "";
  if (!name) {
    return NextResponse.json({ error: "Enter the event name." }, { status: 400 });
  }
  const dateError = eventDateWindowError(date);
  if (dateError) {
    return NextResponse.json({ error: dateError }, { status: 400 });
  }

  const { data: live } = await supabase
    .from("events")
    .select("id")
    .eq("athlete_id", user.id)
    .in("status", ["draft", "live"])
    .limit(1);
  if (live && live.length > 0) {
    return NextResponse.json(
      { error: "One live event at a time." },
      { status: 400 },
    );
  }

  const slug = slugify(name);
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      athlete_id: user.id,
      name,
      date: new Date(date).toISOString(),
      city: (body.city ?? "").trim() || null,
      sport: (body.sport ?? "").trim() || null,
      slug,
      status: "live",
      likeness_opt_in: Boolean(body.likeness_opt_in),
      appearance_price_cents: body.appearance_price_cents ?? null,
    })
    .select("id, slug")
    .single();

  if (error || !event) {
    console.log("Event insert failed", error?.message);
    return NextResponse.json({ error: "Could not create the event." }, { status: 500 });
  }

  const zoneRows = ZONE_NAMES.map((zoneName) => ({
    event_id: event.id,
    name: zoneName,
    status:
      body.zones && isZoneName(zoneName) && body.zones[zoneName] === "closed"
        ? "closed"
        : "open",
  }));

  const { error: zoneError } = await supabase.from("zones").insert(zoneRows);
  if (zoneError) {
    console.log("Zone insert failed", zoneError.message);
    return NextResponse.json({ error: "Event saved, zones failed." }, { status: 500 });
  }

  console.log("Event published", event.slug);
  return NextResponse.json({ slug: event.slug });
}
