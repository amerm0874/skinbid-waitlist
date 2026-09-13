"use client";

import { logoPrintLine } from "@/lib/athlete-status";

type Props = {
  href: string;
  zoneLabel: string;
  fileName: string;
};

async function savePng(href: string, fileName: string) {
  const response = await fetch(href);
  if (!response.ok) {
    throw new Error("Logo download failed.");
  }
  const blob = await response.blob();
  const png =
    blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
  const url = URL.createObjectURL(png);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DownloadLogo({ href, zoneLabel, fileName }: Props) {
  async function onClick() {
    try {
      await savePng(href, fileName);
      console.log("Logo downloaded", fileName);
    } catch (error) {
      console.log("Logo download failed", error);
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="event-zone-owner">
      <button type="button" className="btn btn-ghost" onClick={() => void onClick()}>
        Download logo
      </button>
      <p className="fine text-[13px] text-muted">{logoPrintLine(zoneLabel)}</p>
    </div>
  );
}
