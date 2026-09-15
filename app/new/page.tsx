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
  athletePublishReady,
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
import { loadAthleteZoneRects } from "@/lib/athlete-zone-rects";
import {
  loadBodyPhotos,
} from "@/lib/body-photos";

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

    if (existing?.status === "live") {
      const publishReady = await athletePublishReady(supabase, user.id);
      if (!publishReady) {
        await demoteLiveWithoutReadyGlb(supabase, user.id);
        existing = { ...existing, status: "draft" };
      }
    }
  }

  const officialEvents = await loadUpcomingOfficialEvents(
    supabase,
    profile.sport,
  );

  const bodyPhotos = await loadBodyPhotos(user.id);
  const savedRects = supabase
    ? await loadAthleteZoneRects(supabase, user.id)
    : {};

  const heading =
    existing?.status === "live"
      ? "Edit photos & slots"
      : existing?.status === "draft"
        ? "Place your slots"
        : "List a race";

  const lead =
    existing?.status === "live"
      ? "Adjust available placements on your approved photos. Placements with bids stay locked."
      : existing?.status === "draft"
        ? "Finish your photos and introduction video in your profile, then position the placements you want to offer."
        : "Choose your race and add its details. Your photos, video and sponsorship placements are managed from your athlete profile.";

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
          bodyPhotos={bodyPhotos}
          savedRects={savedRects}
        />
      </div>
    </ProductShell>
  );
}
