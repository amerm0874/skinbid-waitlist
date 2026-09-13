import { cachedOfficialPageFacts } from "@/lib/official-page";

export async function fetchOfficialOgImage(pageUrl: string) {
  return (await cachedOfficialPageFacts(pageUrl)).og_image_url;
}

export async function cachedOfficialOgImage(pageUrl: string) {
  return (await cachedOfficialPageFacts(pageUrl)).og_image_url;
}
