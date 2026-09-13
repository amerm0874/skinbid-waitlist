"use client";

import dynamic from "next/dynamic";
import { isReadyAvatar } from "@/lib/event-create";

const EventCage = dynamic(() => import("@/components/cage/EventCage"), {
  ssr: false,
  loading: () => <div className="event-cage cage-loading" />,
});

export function AthleteBody({ glbUrl }: { glbUrl: string }) {
  if (!isReadyAvatar({ ready: true, glb_url: glbUrl })) {
    return null;
  }
  return (
    <div className="athlete-stage">
      <EventCage
        glbUrl={glbUrl}
        zones={[]}
        selected={null}
        onSelect={() => {}}
      />
    </div>
  );
}
