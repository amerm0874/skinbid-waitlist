import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/skinbid-wordmark.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B0B0C",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <img src={logoSrc} width={186} height={123} alt="" />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              color: "#F2F2F0",
            }}
          >
            {SITE.ogHeadline}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              color: "#9A9A94",
            }}
          >
            {SITE.title}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
