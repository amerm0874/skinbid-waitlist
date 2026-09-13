import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import {
  listPublishedAthleteHandles,
  listPublishedEventSlugs,
} from "@/lib/public-listings";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Published /e/[slug] + /a/[handle] only. Drafts and the fake demo stay out.
  const [events, handles] = await Promise.all([
    listPublishedEventSlugs(),
    listPublishedAthleteHandles(),
  ]);

  const eventUrls = events.map((event) => ({
    url: `${SITE.url}/e/${event.slug}`,
    lastModified: new Date(event.date),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const athleteUrls = handles.map((handle) => ({
    url: `${SITE.url}/a/${handle}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...eventUrls, ...athleteUrls];
}
