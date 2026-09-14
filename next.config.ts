import type { NextConfig } from "next";

const longCache = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const posthogHost =
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
const posthogAssets = posthogHost.includes("eu.")
  ? "https://eu-assets.i.posthog.com"
  : "https://us-assets.i.posthog.com";

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "/**" },
      { protocol: "http", hostname: "**", pathname: "/**" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host" as const, value: "skinbid.me" }],
        destination: "https://www.skinbid.me/",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "skinbid.me" }],
        destination: "https://www.skinbid.me/:path*",
        permanent: true,
      },
      {
        source: "/waitlist",
        destination: "/login",
        permanent: false,
      },
      {
        source: "/hero-slots.png",
        destination: "/hero-slots.webp",
        permanent: true,
      },
      {
        source: "/poster-male.png",
        destination: "/poster-male.webp",
        permanent: true,
      },
      {
        source: "/poster-female.png",
        destination: "/poster-female.webp",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${posthogAssets}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `${posthogAssets}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/avatar-male.glb",
        headers: longCache,
      },
      {
        source: "/avatar-female.glb",
        headers: longCache,
      },
      {
        source: "/placeholder.glb",
        headers: longCache,
      },
      {
        source: "/draco/:file*",
        headers: longCache,
      },
      {
        source: "/hero-slots.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/sports/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
