"use client";

import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { disposeCageStickers, syncCageStickers } from "@/lib/cage-stickers";
import { POSTER_SRC } from "@/lib/landing-media";
import {
  defaultHitForZone,
  nearestHit,
  slotWorld,
  type ZoneHit,
} from "@/lib/zone-views";
import { type ZoneName } from "@/lib/zones";
import BodyCanvas, {
  type BodyCanvasHandle,
  type BodyFrame,
  type CameraPose,
} from "@/components/cage/BodyCanvas";

export type CageZone = {
  name: ZoneName;
  status: "open" | "closed";
  occupied: boolean;
  logoUrl?: string | null;
  brandLabel?: string | null;
};

type Props = {
  glbUrl: string;
  zones: CageZone[];
  selected: ZoneName | null;
  onSelect: (name: ZoneName) => void;
  lookNonce?: number;
};

type TurnHandle = {
  cancel: () => void;
};

const TARGET_HEIGHT_M = 1.7;
const STUDIO = "#111111";
const FOV_DEG = 34;
const EXPOSURE = 1.15;
const HOME_PHI = 75;
const HOME_RADIUS = 4.15;
const TURN_MS = 400;

function cageSrc(glbUrl: string) {
  const url = glbUrl.trim();
  if (!url || url.toLowerCase().includes("placeholder.glb")) {
    return "";
  }
  return url;
}

function homeTargetY(frame: BodyFrame) {
  return frame.center.y - frame.size.y / 2 + 0.52 * frame.size.y;
}

function homePose(frame: BodyFrame): CameraPose {
  return {
    theta: 0,
    phi: HOME_PHI,
    radius: HOME_RADIUS,
    target: { x: 0, y: homeTargetY(frame), z: 0 },
  };
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function shortestTheta(from: number, to: number) {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta;
}

function hitCameraPose(hit: ZoneHit, frame: BodyFrame): CameraPose {
  const world = slotWorld(hit, frame);
  if (hit.zone === "abs") {
    return {
      theta: 0,
      phi: 78,
      radius: 2.15,
      target: { x: 0, y: world.y, z: 0 },
    };
  }
  const lookY = homeTargetY(frame) * 0.35 + world.y * 0.65;
  return {
    theta: hit.theta,
    phi: hit.phi,
    radius: hit.radius,
    target: { x: 0, y: lookY, z: 0 },
  };
}

function turnCamera(
  canvas: BodyCanvasHandle,
  pose: CameraPose,
  options: { durationMs: number },
): TurnHandle {
  let raf = 0;
  let cancelled = false;

  function finish() {
    if (cancelled) {
      return;
    }
    canvas.applyPose(pose);
    canvas.lockVertical(pose);
  }

  if (options.durationMs <= 0) {
    finish();
    return {
      cancel() {
        cancelled = true;
      },
    };
  }

  const from = canvas.readPose();
  if (!from) {
    finish();
    return {
      cancel() {
        cancelled = true;
      },
    };
  }

  canvas.unlockTravel();
  const toTheta = shortestTheta(from.theta, pose.theta);
  const startedAt = performance.now();

  const tick = (now: number) => {
    if (cancelled) {
      return;
    }
    const t = Math.min(1, (now - startedAt) / options.durationMs);
    const k = easeInOutCubic(t);
    canvas.applyPose({
      theta: lerp(from.theta, toTheta, k),
      phi: lerp(from.phi, pose.phi, k),
      radius: lerp(from.radius, pose.radius, k),
      target: {
        x: lerp(from.target.x, pose.target.x, k),
        y: lerp(from.target.y, pose.target.y, k),
        z: lerp(from.target.z, pose.target.z, k),
      },
    });
    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      finish();
    }
  };
  raf = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
  };
}

function EventCage({ glbUrl, zones, selected, onSelect, lookNonce = 0 }: Props) {
  const src = cageSrc(glbUrl);
  const poster = src.includes("avatar-male.glb") ? POSTER_SRC.male : undefined;
  const canvasRef = useRef<BodyCanvasHandle | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyFrameRef = useRef<BodyFrame | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, dragged: false, down: false });
  const turnRef = useRef<TurnHandle | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [overSlot, setOverSlot] = useState(false);
  const canPick = zones.length > 0;
  const logoKey = zones
    .map((zone) => `${zone.name}:${zone.logoUrl ?? ""}`)
    .join("|");

  onSelectRef.current = onSelect;
  selectedRef.current = selected;

  function turnToHit(hit: ZoneHit) {
    const canvas = canvasRef.current;
    const frame = bodyFrameRef.current;
    if (!canvas || !frame || !modelLoaded) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    turnRef.current?.cancel();
    const pose = hitCameraPose(hit, frame);
    console.log("Cage look", hit.zone, pose.theta, pose.phi, pose.radius);
    turnRef.current = turnCamera(canvas, pose, {
      durationMs: reduced ? 0 : TURN_MS,
    });
  }

  function pickHit(hit: ZoneHit) {
    onSelectRef.current(hit.zone);
    turnToHit(hit);
    console.log("Cage zone", hit.zone);
  }

  function handleLoaded(frame: BodyFrame) {
    bodyFrameRef.current = frame;
    const canvas = canvasRef.current;
    if (canvas) {
      const zone = selectedRef.current;
      const pose = zone
        ? hitCameraPose(defaultHitForZone(zone), frame)
        : homePose(frame);
      canvas.applyPose(pose);
      canvas.lockVertical(pose);
    }
    setModelLoaded(true);
    console.log("EventCage loaded", src);
  }

  useLayoutEffect(() => {
    if (!modelLoaded || !selected) {
      return;
    }
    turnToHit(defaultHitForZone(selected));
  }, [selected, modelLoaded, lookNonce]);

  useEffect(() => {
    if (!modelLoaded) {
      return;
    }
    const canvas = canvasRef.current;
    const root = canvas?.getRoot();
    const frame = bodyFrameRef.current;
    if (!root || !frame) {
      return;
    }
    let cancelled = false;
    void syncCageStickers(root, zones, frame);
    return () => {
      cancelled = true;
      void cancelled;
    };
  }, [modelLoaded, logoKey]);

  useEffect(() => {
    return () => {
      turnRef.current?.cancel();
      turnRef.current = null;
      disposeCageStickers(canvasRef.current?.getRoot() ?? null);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const blockWheelZoom = (event: WheelEvent) => {
      event.stopImmediatePropagation();
    };
    frame.addEventListener("wheel", blockWheelZoom, {
      capture: true,
      passive: true,
    });
    return () => {
      frame.removeEventListener("wheel", blockWheelZoom, { capture: true });
    };
  }, []);

  function hitAtPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const frame = bodyFrameRef.current;
    if (!canvas || !frame || !canPick) {
      return undefined;
    }
    const point = canvas.raycast(clientX, clientY);
    if (!point) {
      return undefined;
    }
    return nearestHit(frame, { x: point.x, y: point.y, z: point.z });
  }

  function onBodyPointerDown(event: ReactPointerEvent) {
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      dragged: false,
      down: true,
    };
  }

  function onBodyPointerMove(event: ReactPointerEvent) {
    const start = pointerRef.current;
    if (start.down) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy > 64) {
        start.dragged = true;
      }
    }
    const next = Boolean(hitAtPoint(event.clientX, event.clientY));
    setOverSlot((prev) => (prev === next ? prev : next));
  }

  function onBodyPointerUp(event: ReactPointerEvent) {
    const wasDrag = pointerRef.current.dragged;
    pointerRef.current.down = false;
    if (wasDrag) {
      return;
    }
    const hit = hitAtPoint(event.clientX, event.clientY);
    if (hit) {
      pickHit(hit);
    }
  }

  function onBodyPointerLeave() {
    pointerRef.current.down = false;
    setOverSlot(false);
  }

  if (!src) {
    return <div className="event-cage" />;
  }

  return (
    <div ref={frameRef} className="event-cage">
      {!modelLoaded && poster ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            width={1280}
            height={675}
            decoding="async"
            className="event-cage-poster"
          />
          <p className="event-cage-wait">Loading 3D…</p>
        </>
      ) : null}
      {!modelLoaded && !poster ? (
        <p className="event-cage-wait">Loading 3D…</p>
      ) : null}

      <BodyCanvas
        ref={canvasRef}
        src={src}
        targetHeight={TARGET_HEIGHT_M}
        fovDeg={FOV_DEG}
        background={STUDIO}
        exposure={EXPOSURE}
        className={overSlot ? "is-over-slot" : undefined}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: STUDIO,
          cursor: overSlot ? "pointer" : "grab",
        }}
        onLoaded={handleLoaded}
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={onBodyPointerUp}
        onPointerLeave={onBodyPointerLeave}
      />
    </div>
  );
}

export default memo(EventCage);
