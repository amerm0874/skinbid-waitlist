import type { NextConfig } from "next";

const longCache = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["three"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "/**" },
      { protocol: "http", hostname: "**", pathname: "/**" },
    ],
  },
  async redirects() {
    return [
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
