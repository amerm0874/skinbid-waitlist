import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/events",
        "/login",
        "/admin",
        "/new",
        "/outreach",
        "/onboarding",
        "/e/",
        "/proof/",
        "/inbox",
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
