import { MODEL_SRC } from "@/lib/landing-media";

export const DEMO_SLUG = "demo";
// Demo cage uses the landing Alex body (lime pads). The gray placeholder.glb is never a body.
export const DEMO_GLB = MODEL_SRC.male;

export const DEMO_EVENT = {
  id: "demo-event",
  athlete_id: "demo-athlete",
  athlete_name: "A. RIVER",
  name: "Open Circuit",
  date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  city: "Lisbon",
  sport: "Hyrox",
  slug: DEMO_SLUG,
  status: "live" as const,
  likeness_opt_in: false,
  glb_url: DEMO_GLB,
};
