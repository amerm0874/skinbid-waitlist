import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { catalogDateToLocal } from "@/lib/official-events";
import { cachedOfficialPageFacts } from "@/lib/official-page";
import { eventDateWindowError } from "@/lib/auction";

export async function POST(request: Request) {
  const { user, profile } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (profile?.role !== "athlete") {
    return NextResponse.json({ error: "Athletes only." }, { status: 403 });
  }

  const body = (await request.json()) as { url?: string };
  const url = body.url?.trim() ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Enter an official page URL." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Enter an official page URL." }, { status: 400 });
  }

  const facts = await cachedOfficialPageFacts(url);
  const dateOk =
    facts.date && !eventDateWindowError(catalogDateToLocal(facts.date));
  return NextResponse.json({
    name: facts.name,
    date: dateOk ? facts.date : null,
    city: facts.city,
    country: facts.country,
    venue: facts.venue,
  });
}
