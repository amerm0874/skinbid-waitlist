"use client";

import { useEffect, useRef, useState } from "react";
import { ZONE_LABEL, type ZoneName } from "@/lib/zones";
import {
  zonePlacement,
  zonesOnPhoto,
  type ZonePhotoSide,
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
  athleteName: string;
  frameNonce?: number;
};

type Box = { x: number; y: number; w: number; h: number };

const FRAME_SCALE = 1.85;

function containedBox(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): Box | null {
  if (containerW < 1 || containerH < 1 || imageW < 1 || imageH < 1) {
    return null;
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return {
    x: (containerW - w) / 2,
    y: (containerH - h) / 2,
    w,
    h,
  };
}

export default function PhotoStage({
  frontUrl,
  backUrl,
  zones,
  selected,
  onSelect,
  athleteName,
  frameNonce = 0,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [side, setSide] = useState<ZonePhotoSide>("front");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!selected) {
      return;
    }
    setSide(zonePlacement(selected).photo);
  }, [selected]);

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

  const photoUrl = side === "front" ? frontUrl : backUrl;

  useEffect(() => {
    setNatural({ w: 0, h: 0 });
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, [photoUrl]);

  const map = containedBox(viewport.w, viewport.h, natural.w, natural.h);
  const byName = new Map(zones.map((zone) => [zone.name, zone]));
  const visible = zonesOnPhoto(side).filter(() => Boolean(photoUrl));
  const framed =
    frameNonce > 0 && selected && zonePlacement(selected).photo === side
      ? selected
      : null;
  const focus = framed && map ? zoneFocus(framed, map) : null;

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
      <div className="photo-stage-viewport" ref={viewportRef}>
        <div
          className="photo-stage-inner"
          style={
            focus && viewport.w && viewport.h
              ? {
                  transformOrigin: `${(focus.x / viewport.w) * 100}% ${
                    (focus.y / viewport.h) * 100
                  }%`,
                  transform: `translate(${50 - (focus.x / viewport.w) * 100}%, ${
                    50 - (focus.y / viewport.h) * 100
                  }%) scale(${FRAME_SCALE})`,
                }
              : undefined
          }
        >
          {photoUrl ? (
            // Athlete photo from storage; next/image needs a host allow-list.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={photoUrl}
              alt={`${athleteName} ${side}`}
              className="photo-stage-photo"
              draggable={false}
              onLoad={(event) => {
                setNatural({
                  w: event.currentTarget.naturalWidth,
                  h: event.currentTarget.naturalHeight,
                });
              }}
            />
          ) : (
            <p className="photo-stage-missing">No {side} photo yet.</p>
          )}

          {map ? (
            <div
              className="photo-stage-map"
              style={{
                left: map.x,
                top: map.y,
                width: map.w,
                height: map.h,
              }}
            >
              {visible.map((name) => {
                const zone = byName.get(name);
                const { rect } = zonePlacement(name);
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
                    }${zone?.status === "closed" ? " is-closed" : ""}`}
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
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {frontUrl && backUrl ? (
        <div className="photo-stage-sides">
          <button
            type="button"
            className={`photo-stage-side${side === "front" ? " is-on" : ""}`}
            onClick={() => setSide("front")}
          >
            Front
          </button>
          <button
            type="button"
            className={`photo-stage-side${side === "back" ? " is-on" : ""}`}
            onClick={() => setSide("back")}
          >
            Back
          </button>
        </div>
      ) : null}
    </div>
  );
}

function zoneFocus(name: ZoneName, map: Box) {
  const { rect } = zonePlacement(name);
  return {
    x: map.x + (map.w * (rect.x + rect.w / 2)) / 100,
    y: map.y + (map.h * (rect.y + rect.h / 2)) / 100,
  };
}
