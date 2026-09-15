"use client";

import { useEffect, useRef, useState } from "react";
import { ZONE_LABEL, type ZoneName } from "@/lib/zones";
import {
  drawnPhotoZones,
  zonePlacement,
  zonePhotoSide,
  type ZonePhotoSide,
  type ZoneRect,
} from "@/lib/zone-photos";

export type PhotoZone = {
  name: ZoneName;
  status: "open" | "closed";
  occupied: boolean;
  logoUrl?: string | null;
  brandLabel?: string | null;
};

type Props = {
  frontUrl: string | null;
  backUrl: string | null;
  zones: PhotoZone[];
  selected: ZoneName | null;
  onSelect: (name: ZoneName) => void;
  onClear?: () => void;
  athleteName: string;
  savedRects?: Partial<Record<ZoneName, ZoneRect>> | null;
  useDefaultRects?: boolean;
};

type Box = { x: number; y: number; w: number; h: number };

function photoBox(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): Box | null {
  if (containerW < 1 || containerH < 1 || imageW < 1 || imageH < 1) {
    return null;
  }
  const fit = Math.min(containerW / imageW, containerH / imageH);
  const w = imageW * fit;
  const h = imageH * fit;
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  };
}

function PhotoPane({
  url,
  side,
  athleteName,
  zones,
  savedRects,
  selected,
  onSelect,
  onClear,
  useDefaultRects,
}: {
  url: string | null;
  side: ZonePhotoSide;
  athleteName: string;
  zones: PhotoZone[];
  savedRects?: Partial<Record<ZoneName, ZoneRect>> | null;
  selected: ZoneName | null;
  onSelect: (name: ZoneName) => void;
  onClear?: () => void;
  useDefaultRects: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [failed, setFailed] = useState(false);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    const sync = () => {
      setViewport({ w: node.clientWidth, h: node.clientHeight });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [url]);

  const byName = new Map(zones.map((zone) => [zone.name, zone]));
  const closed = new Set(
    zones.filter((zone) => zone.status === "closed").map((zone) => zone.name),
  );
  const visible = url
    ? drawnPhotoZones(side, {
        saved: savedRects,
        closed,
        savedOnly: !useDefaultRects,
      })
    : [];
  const map = photoBox(viewport.w, viewport.h, natural.w, natural.h);

  return (
    <div className="photo-stage-pane" data-side={side}>
      <div className="photo-stage-viewport" ref={viewportRef}>
        {url && !failed ? (
          // Athlete photo from storage; next/image needs a host allow-list.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={url}
            alt={`${athleteName} ${side}`}
            className="photo-stage-photo"
            draggable={false}
            style={
              map
                ? {
                    inset: "auto",
                    left: map.x,
                    top: map.y,
                    width: map.w,
                    height: map.h,
                    objectFit: "fill",
                  }
                : undefined
            }
            onLoad={(event) => {
              setNatural({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              });
            }}
            onError={() => setFailed(true)}
          />
        ) : (
          <p className="photo-stage-missing" role="status">{failed ? "Photo could not load. Refresh the page to try again." : `No ${side} photo yet.`}</p>
        )}

        {map && !failed ? (
          <div
            className="photo-stage-map"
            style={{
              left: map.x,
              top: map.y,
              width: map.w,
              height: map.h,
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onClear?.();
              }
            }}
          >
            {visible.map((name) => {
              const zone = byName.get(name);
              const { rect } = zonePlacement(name, savedRects);
              const isOn = selected === name;
              const logo = zone?.logoUrl?.trim() || null;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isOn}
                  aria-label={ZONE_LABEL[name]}
                  className={`photo-zone${isOn ? " is-on" : ""}${
                    logo ? " is-filled" : ""
                  }`}
                  style={{
                    left: `${rect.x}%`,
                    top: `${rect.y}%`,
                    width: `${rect.w}%`,
                    height: `${rect.h}%`,
                  }}
                  onClick={() => onSelect(name)}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      className="photo-zone-logo"
                      draggable={false}
                    />
                  ) : (
                    <span className="photo-zone-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PhotoStage({
  frontUrl,
  backUrl,
  zones,
  selected,
  onSelect,
  onClear,
  athleteName,
  savedRects = null,
  useDefaultRects = false,
}: Props) {
  const [view, setView] = useState<ZonePhotoSide>(frontUrl ? "front" : "back");
  const side = selected ? zonePhotoSide(selected) : view;
  if (!frontUrl && !backUrl) {
    return (
      <div className="photo-stage photo-stage-empty">
        <p className="photo-stage-empty-title">No body photos yet</p>
        <p className="photo-stage-empty-sub">
          {athleteName} needs a front and back photo before zones can be shown.
        </p>
      </div>
    );
  }

  return (
    <div className="photo-stage">
      <div className="photo-view-controls" role="group" aria-label="Photo view">
        {(["front", "back"] as const).map((value) => <button key={value} type="button" aria-pressed={side === value} disabled={value === "front" ? !frontUrl : !backUrl} onClick={() => { onClear?.(); setView(value); }}>{value === "front" ? "Front view" : "Back view"}</button>)}
      </div>
      <div className="photo-stage-split is-single">
        {side === "front" ? (
          <PhotoPane
            key={`front-${frontUrl}`}
            url={frontUrl}
            side="front"
            athleteName={athleteName}
            zones={zones}
            savedRects={savedRects}
            selected={selected}
            onSelect={onSelect}
            onClear={onClear}
            useDefaultRects={useDefaultRects}
          />
        ) : null}
        {side === "back" ? (
          <PhotoPane
            key={`back-${backUrl}`}
            url={backUrl}
            side="back"
            athleteName={athleteName}
            zones={zones}
            savedRects={savedRects}
            selected={selected}
            onSelect={onSelect}
            onClear={onClear}
            useDefaultRects={useDefaultRects}
          />
        ) : null}
      </div>
      <p className="photo-caption">{selected ? ZONE_LABEL[selected] : "Placements are positioned by the athlete"}</p>
    </div>
  );
}
