import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        }}
      >
        <div
          style={{
            fontSize: 28,
            letterSpacing: "0.08em",
            color: "#F2F2F0",
          }}
        >
          SKINBID
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 0.95,
              color: "#F2F2F0",
              textTransform: "uppercase",
            }}
          >
            {SITE.ogHeadline}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 24,
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
