import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NO_OG_METADATA } from "@/lib/seo";
import {
  athleteSportComplete,
  homeForCompleteProfile,
  loginPath,
  onboardingPath,
  sessionGateRedirect,
} from "@/lib/config";
import { loadCaptureState } from "@/lib/capture-state";
import {
  demoteLiveWithoutReadyGlb,
  isReadyAvatar,
} from "@/lib/event-create";
import {
  loadUpcomingOfficialEvents,
  officialEventByStartsOn,
  parseOfficialStartsOn,
} from "@/lib/official-events";
import { ProductShell } from "@/components/product/ProductShell";
import NewEventForm, { type ListedEvent } from "./NewEventForm";

export const metadata: Metadata = {
  title: "New event",
  ...NO_OG_METADATA,
};

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ race?: string | string[] }>;
}) {
  const raceKey = parseOfficialStartsOn((await searchParams).race);
  const newPath = raceKey ? `/new?race=${raceKey}` : "/new";
  const { supabase, user, profile } = await getSessionUser();
  const gate = sessionGateRedirect(user, profile, newPath);
  if (gate) {
    redirect(gate);
  }
  if (!user) {
    redirect(loginPath(null, newPath));
  }
  if (profile?.role !== "athlete") {
    redirect(homeForCompleteProfile(profile));
  }
  if (!athleteSportComplete(profile)) {
    redirect(onboardingPath("athlete"));
  }

  let existing: ListedEvent | null = null;
  let avatarReady = false;
  let scanUploaded = false;
  let modelPaid = false;

  if (supabase) {
    const { data: rows } = await supabase
      .from("events")
      .select("id, name, slug, status, date, city, sport")
      .eq("athlete_id", user.id)
      .in("status", ["draft", "live"])
      .order("status", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (row && (row.status === "draft" || row.status === "live")) {
      existing = row as ListedEvent;
    }

    const { data: avatar } = await supabase
      .from("avatars")
      .select("ready, glb_url")
      .eq("athlete_id", user.id)
      .maybeSingle();
    avatarReady = isReadyAvatar(avatar);

    const captureState = await loadCaptureState(supabase, user.id);
    scanUploaded = captureState.scanUploaded;
    modelPaid = captureState.modelPaid;

    if (existing?.status === "live" && !avatarReady) {
      await demoteLiveWithoutReadyGlb(supabase, user.id);
      existing = { ...existing, status: "draft" };
    }
  }

  const officialEvents = await loadUpcomingOfficialEvents(
    supabase,
    profile.sport,
  );

  const heading =
    existing?.status === "live"
      ? "Event is public"
      : existing?.status === "draft"
        ? "Scan your body"
        : "List a race";

  const lead =
    existing?.status === "live"
      ? "One event at a time. Brands bid on the twelve body slots."
      : existing?.status === "draft"
        ? "Scan your body. Until the 3D body is ready, this listing is not public."
        : "Pick an official race for your sport, or type a custom name. Date (4 days to 12 months out), country, city, event link, likeness. Twelve slots start open. You can close any of them.";

  return (
    <ProductShell email={user.email} role={profile.role}>
      <div className="page-stack">
        <div>
          <h1 className="display page-title">{heading}</h1>
          <p className="page-lead">{lead}</p>
        </div>
        <NewEventForm
          userId={user.id}
          avatarReady={avatarReady}
          scanUploaded={scanUploaded}
          modelPaid={modelPaid}
          existing={existing}
          profileCountry={profile.country}
          profileSport={profile.sport}
          profileSportDetail={profile.sport_detail}
          officialEvents={officialEvents}
          prefillRace={officialEventByStartsOn(raceKey)}
        />
      </div>
    </ProductShell>
  );
}
