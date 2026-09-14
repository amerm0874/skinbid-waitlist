import { ImageResponse } from "next/og";
import { SITE } from "@/lib/config";
import { formatRaceDay } from "@/lib/official-events";
import { loadAthleteByHandle } from "@/lib/public-listings";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SkinBid athlete";

type Props = {
  params: Promise<{ handle: string }>;
};

export default async function AthleteOgImage({ params }: Props) {
  const { handle } = await params;
  const athlete = await loadAthleteByHandle(handle);
  const name = athlete?.name ?? "Athlete";
  const raceName = athlete?.liveEvent?.name ?? athlete?.race?.name ?? null;
  const raceDate = athlete?.liveEvent?.date ?? athlete?.race?.starts_on ?? null;
  const city = athlete?.liveEvent?.city ?? athlete?.race?.city ?? null;
  const photo = athlete?.photoUrl?.trim() || null;
  const raceLine = [raceName, city, raceDate ? formatRaceDay(raceDate) : null]
    .filter(Boolean)
    .join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0B0B0C",
          color: "#F2F2F0",
        }}
      >
        <div
          style={{
            width: 560,
            height: "100%",
            display: "flex",
            overflow: "hidden",
            background: "#111",
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={560}
              height={630}
              style={{
                width: 560,
                height: 630,
                objectFit: "cover",
                objectPosition: "center top",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "flex-end",
                padding: 40,
                fontSize: 220,
                lineHeight: 0.8,
                letterSpacing: "-0.06em",
                textTransform: "uppercase",
              }}
            >
              {name.trim().slice(0, 1)}
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 56px 48px",
          }}
        >
          <div
            style={{
              fontSize: 22,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            SKINBID
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 0.9,
                textTransform: "uppercase",
              }}
            >
              {name}
            </div>
            {raceLine ? (
              <div
                style={{
                  marginTop: 28,
                  fontSize: 28,
                  color: "#C8F24E",
                  lineHeight: 1.25,
                }}
              >
                {raceLine}
              </div>
            ) : null}
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#9A9A94",
            }}
          >
            {SITE.name}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
