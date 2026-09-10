import Link from "next/link";

const LOGO_WIDTH = 250;
const LOGO_HEIGHT = 163;

export function Wordmark({
  href = "/",
  size = "nav",
}: {
  href?: string;
  size?: "nav" | "footer";
}) {
  // Solid white stacked mark. Plain <img> so the browser cannot keep an old cached outline.
  const height = size === "footer" ? 52 : 36;
  const width = Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height);

  return (
    <Link
      href={href}
      className={size === "footer" ? "wordmark wordmark-footer" : "wordmark"}
      aria-label="SkinBid home"
    >
      <img
        src="/skinbid-wordmark.png"
        alt=""
        width={width}
        height={height}
      />
    </Link>
  );
}
