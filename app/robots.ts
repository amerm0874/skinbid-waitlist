import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/events", "/e", "/a"],
      disallow: [
        "/admin",
        "/proof",
        "/login",
        "/signup",
        "/onboarding",
        "/new",
        "/outreach",
        "/me",
        "/settings",
        "/inbox",
        "/api",
      ],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
