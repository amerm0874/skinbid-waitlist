"use client";

import type { ModelViewerElement } from "@google/model-viewer";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DRACO_PATH, POSTER_SRC } from "@/lib/landing-media";
import {
  defaultHitForZone,
  ZONE_HITS,
  type ZoneHit,
} from "@/lib/zone-views";
import { type ZoneName } from "@/lib/zones";

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
};

type BodyFrame = {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

type OrbitPose = {
  theta: number;
  phi: number;
  radius: number;
  target: { x: number; y: number; z: number };
};

type TurnHandle = {
  cancel: () => void;
};

type ModelViewerCtor = typeof ModelViewerElement & {
  dracoDecoderLocation: string;
};

let modelViewerPromise: Promise<ModelViewerCtor> | null = null;

function ensureModelViewer() {
  if (!modelViewerPromise) {
    modelViewerPromise = import(
      /* webpackPreload: true */
      "@google/model-viewer"
    ).then((mod) => {
      const El = mod.ModelViewerElement as ModelViewerCtor;
      El.dracoDecoderLocation = DRACO_PATH;
      return El;
    });
  }
  return modelViewerPromise;
}

if (typeof window !== "undefined") {
  void ensureModelViewer();
}

const TARGET_HEIGHT_M = 1.7;
const STUDIO = "#111111";
const HOME_PHI = 75;
const HOME_RADIUS = 4.15;
const IDLE_ORBIT_MIN = `auto ${HOME_PHI}deg ${HOME_RADIUS}m`;
const IDLE_ORBIT_MAX = `auto ${HOME_PHI}deg ${HOME_RADIUS}m`;
const TRAVEL_ORBIT_MIN = "auto 50deg 2.1m";
const TRAVEL_ORBIT_MAX = "auto 105deg 6.5m";
const TURN_MS = 400;
const SLOT_HIT_M = 0.34;

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

function homePose(frame: BodyFrame): OrbitPose {
  return {
    theta: 0,
    phi: HOME_PHI,
    radius: HOME_RADIUS,
    target: { x: 0, y: homeTargetY(frame), z: 0 },
  };
}

function poseToOrbit(pose: OrbitPose) {
  return `${pose.theta.toFixed(3)}deg ${pose.phi.toFixed(3)}deg ${pose.radius.toFixed(4)}m`;
}

function poseToTarget(pose: OrbitPose) {
  return `${pose.target.x.toFixed(4)}m ${pose.target.y.toFixed(4)}m ${pose.target.z.toFixed(4)}m`;
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

function readPose(viewer: ModelViewerElement): OrbitPose {
  const orbit = viewer.getCameraOrbit();
  const target = viewer.getCameraTarget();
  return {
    theta: (orbit.theta * 180) / Math.PI,
    phi: (orbit.phi * 180) / Math.PI,
    radius: orbit.radius,
    target: { x: target.x, y: target.y, z: target.z },
  };
}

function applyPose(viewer: ModelViewerElement, pose: OrbitPose) {
  if (!viewer.isConnected) {
    return;
  }
  viewer.cameraOrbit = poseToOrbit(pose);
  viewer.cameraTarget = poseToTarget(pose);
  viewer.jumpCameraToGoal();
}

function unlockTravel(viewer: ModelViewerElement) {
  if (!viewer.isConnected) {
    return;
  }
  viewer.minCameraOrbit = TRAVEL_ORBIT_MIN;
  viewer.maxCameraOrbit = TRAVEL_ORBIT_MAX;
}

function lockOrbit(viewer: ModelViewerElement, pose: OrbitPose) {
  if (!viewer.isConnected) {
    return;
  }
  const orbit = poseToOrbit(pose);
  viewer.minCameraOrbit = orbit;
  viewer.maxCameraOrbit = orbit;
  applyPose(viewer, pose);
}

function turnCamera(
  viewer: ModelViewerElement,
  pose: OrbitPose,
  options: {
    durationMs: number;
    lock: boolean;
    onIdle?: () => void;
  },
): TurnHandle {
  let raf = 0;
  let cancelled = false;

  function finish() {
    if (cancelled || !viewer.isConnected) {
      return;
    }
    if (options.lock) {
      lockOrbit(viewer, pose);
    } else {
      applyPose(viewer, pose);
      options.onIdle?.();
    }
  }

  if (options.durationMs <= 0) {
    finish();
    return {
      cancel() {
        cancelled = true;
      },
    };
  }

  unlockTravel(viewer);
  raf = requestAnimationFrame(() => {
    raf = requestAnimationFrame(() => {
      if (cancelled || !viewer.isConnected) {
        return;
      }
      const from = readPose(viewer);
      const toTheta = shortestTheta(from.theta, pose.theta);
      const startedAt = performance.now();

      const tick = (now: number) => {
        if (cancelled || !viewer.isConnected) {
          return;
        }
        const t = Math.min(1, (now - startedAt) / options.durationMs);
        const k = easeInOutCubic(t);
        applyPose(viewer, {
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
    });
  });

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(raf);
    },
  };
}

function stopViewer(viewer: ModelViewerElement) {
  try {
    viewer.pause();
    viewer.src = "";
  } catch {
    // The 3D tag is already gone.
  }
}

function slotWorld(hit: ZoneHit, frame: BodyFrame) {
  return {
    x: frame.center.x + (hit.x * frame.size.x) / 2,
    y: frame.center.y - frame.size.y / 2 + hit.y * frame.size.y,
    z: frame.center.z + (hit.z * frame.size.z) / 2,
  };
}

function hitCameraPose(hit: ZoneHit, frame: BodyFrame): OrbitPose {
  const world = slotWorld(hit, frame);
  const lookY = homeTargetY(frame) * 0.25 + world.y * 0.75;
  return {
    theta: hit.theta,
    phi: hit.phi,
    radius: hit.radius,
    target: {
      x: world.x * 0.45,
      y: lookY,
      z: world.z * 0.18,
    },
  };
}

function nearestHit(frame: BodyFrame, point: { x: number; y: number; z: number }) {
  let best: ZoneHit | undefined;
  let bestDist = SLOT_HIT_M;
  for (const hit of ZONE_HITS) {
    const pos = slotWorld(hit, frame);
    const dx = pos.x - point.x;
    const dy = pos.y - point.y;
    const dz = pos.z - point.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = hit;
    }
  }
  return best;
}

function freezeViewer(viewer: ModelViewerElement) {
  if (!viewer.isConnected) {
    return;
  }
  viewer.autoRotate = false;
  viewer.cameraControls = false;
  viewer.interactionPrompt = "none";
}

export default function EventCage({ glbUrl, zones, selected, onSelect }: Props) {
  const src = cageSrc(glbUrl);
  const poster = src.includes("avatar-male.glb") ? POSTER_SRC.male : undefined;
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyFrameRef = useRef<BodyFrame>({
    size: { x: 0.55, y: 1.7, z: 0.28 },
    center: { x: 0, y: 0.85, z: 0 },
  });
  const scaledFrameRef = useRef<BodyFrame | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, dragged: false, down: false });
  const turnRef = useRef<TurnHandle | null>(null);
  const skipTurnRef = useRef(true);
  const spinRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [scaledFrame, setScaledFrame] = useState<BodyFrame | null>(null);
  const [overSlot, setOverSlot] = useState(false);
  const [spin, setSpin] = useState(false);
  const canPick = zones.length > 0;

  onSelectRef.current = onSelect;
  spinRef.current = spin;

  const bindViewer = useCallback((node: ModelViewerElement | null) => {
    const previous = viewerRef.current;
    if (previous && previous !== node) {
      turnRef.current?.cancel();
      turnRef.current = null;
      stopViewer(previous);
    }
    viewerRef.current = node;
  }, []);

  function restoreIdle(viewer: ModelViewerElement) {
    viewer.minCameraOrbit = IDLE_ORBIT_MIN;
    viewer.maxCameraOrbit = IDLE_ORBIT_MAX;
    viewer.cameraControls = true;
    viewer.interactionPrompt = "auto";
    viewer.autoRotate = spinRef.current;
  }

  function turnToHit(hit: ZoneHit) {
    const viewer = viewerRef.current;
    const frame = scaledFrameRef.current ?? bodyFrameRef.current;
    if (!viewer || !modelLoaded) {
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    turnRef.current?.cancel();
    freezeViewer(viewer);
    turnRef.current = turnCamera(viewer, hitCameraPose(hit, frame), {
      durationMs: reduced ? 0 : TURN_MS,
      lock: false,
      onIdle: () => {
        viewer.minCameraOrbit = TRAVEL_ORBIT_MIN;
        viewer.maxCameraOrbit = TRAVEL_ORBIT_MAX;
        viewer.cameraControls = true;
        viewer.interactionPrompt = "auto";
        viewer.autoRotate = false;
      },
    });
  }

  function pickHit(hit: ZoneHit) {
    onSelectRef.current(hit.zone);
    turnToHit(hit);
    console.log("Cage zone", hit.zone);
  }

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelLoaded) {
      return;
    }
    if (skipTurnRef.current) {
      skipTurnRef.current = false;
      return;
    }
    if (!selected) {
      return;
    }
    turnToHit(defaultHitForZone(selected));
  }, [selected, modelLoaded]);

  useEffect(() => {
    function swallowLeftover3D(event: PromiseRejectionEvent) {
      const message = String((event.reason as Error)?.message ?? "");
      if (message.includes("reading 'add'")) {
        event.preventDefault();
      }
    }
    window.addEventListener("unhandledrejection", swallowLeftover3D);
    return () => {
      window.setTimeout(() => {
        window.removeEventListener("unhandledrejection", swallowLeftover3D);
      }, 2500);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function syncSpin() {
      setSpin(!media.matches);
    }
    syncSpin();
    media.addEventListener("change", syncSpin);
    return () => media.removeEventListener("change", syncSpin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let viewer: ModelViewerElement | null = null;
    let loadCount = 0;
    skipTurnRef.current = true;
    setModelLoaded(false);
    setScaledFrame(null);

    const handleLoad = async () => {
      const current = viewerRef.current;
      if (cancelled || !current || !current.isConnected) {
        return;
      }
      const thisLoad = ++loadCount;
      try {
        await frameLoadedBody(current);
      } catch (error) {
        console.log("Could not frame cage body", error);
        return;
      }
      if (cancelled || thisLoad !== loadCount || !current.isConnected) {
        return;
      }
      setModelLoaded(true);
    };

    function handleError() {
      console.log("Cage body failed to load");
    }

    async function frameLoadedBody(loadedViewer: ModelViewerElement) {
      const dimsNow = loadedViewer.getDimensions();
      const scaleNow = parseFloat((loadedViewer.scale || "1 1 1").split(" ")[0]) || 1;
      const factor = dimsNow.y > 0 ? TARGET_HEIGHT_M / dimsNow.y : 1;
      const nextScale = scaleNow * factor;
      if (!loadedViewer.isConnected) {
        return;
      }
      loadedViewer.scale = `${nextScale} ${nextScale} ${nextScale}`;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled || !loadedViewer.isConnected) {
        return;
      }

      const size = loadedViewer.getDimensions();
      const center = loadedViewer.getBoundingBoxCenter();
      const nextScaled: BodyFrame = {
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z },
      };
      const frame: BodyFrame = {
        size: {
          x: size.x / nextScale,
          y: size.y / nextScale,
          z: size.z / nextScale,
        },
        center: {
          x: center.x / nextScale,
          y: center.y / nextScale,
          z: center.z / nextScale,
        },
      };

      // Same studio light as the landing body: neutral IBL, 1.15 exposure, soft shadow.
      loadedViewer.shadowIntensity = 0.85;
      loadedViewer.shadowSoftness = 1;
      loadedViewer.interpolationDecay = 1;
      const pose = homePose(nextScaled);
      loadedViewer.minCameraOrbit = IDLE_ORBIT_MIN;
      loadedViewer.maxCameraOrbit = IDLE_ORBIT_MAX;
      applyPose(loadedViewer, pose);
      restoreIdle(loadedViewer);
      bodyFrameRef.current = frame;
      scaledFrameRef.current = nextScaled;
      setScaledFrame(nextScaled);
      console.log("EventCage loaded", src);
    }

    void ensureModelViewer().then(() => {
      if (cancelled) {
        return;
      }
      viewer = viewerRef.current;
      if (!viewer) {
        return;
      }
      viewer.addEventListener("load", handleLoad);
      viewer.addEventListener("error", handleError);
      if (viewer.loaded) {
        void handleLoad();
      }
    });
    return () => {
      cancelled = true;
      turnRef.current?.cancel();
      turnRef.current = null;
      viewer?.removeEventListener("load", handleLoad);
      viewer?.removeEventListener("error", handleError);
    };
  }, [src]);

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
    const viewer = viewerRef.current;
    if (!viewer || !canPick) {
      return undefined;
    }
    const hit = viewer.positionAndNormalFromPoint(clientX, clientY);
    if (hit == null) {
      return undefined;
    }
    const frame = scaledFrameRef.current ?? bodyFrameRef.current;
    return nearestHit(frame, {
      x: hit.position.x,
      y: hit.position.y,
      z: hit.position.z,
    });
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

  const marks = scaledFrame
    ? zones.filter((zone) => zone.occupied)
    : [];

  if (!src) {
    return <div className="event-cage" />;
  }

  return (
    <div ref={frameRef} className="event-cage">
      {!modelLoaded && poster ? (
        <>
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

      <model-viewer
        ref={bindViewer}
        src={src}
        poster={poster}
        alt=""
        loading="eager"
        reveal="auto"
        camera-controls
        disable-zoom
        field-of-view="34deg"
        min-field-of-view="30deg"
        max-field-of-view="40deg"
        touch-action="none"
        shadow-intensity="0.85"
        shadow-softness="1"
        exposure="1.15"
        environment-image="neutral"
        disable-pan
        interpolation-decay="1"
        interaction-prompt="auto"
        auto-rotate={spin && !selected}
        auto-rotate-delay="0"
        rotation-per-second="22deg"
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={onBodyPointerUp}
        onPointerLeave={onBodyPointerLeave}
        className={overSlot ? "is-over-slot" : undefined}
        style={{
          backgroundColor: STUDIO,
          cursor: overSlot ? "pointer" : "grab",
        }}
      >
        {marks.map((zone) => {
          const pos = slotWorld(defaultHitForZone(zone.name), scaledFrame!);
          return (
            <button
              key={zone.name}
              type="button"
              slot={`hotspot-${zone.name}`}
              data-position={`${pos.x}m ${pos.y}m ${pos.z}m`}
              className={
                zone.name === selected
                  ? "event-cage-mark is-on"
                  : "event-cage-mark"
              }
              onClick={(event) => {
                event.stopPropagation();
                pickHit(defaultHitForZone(zone.name));
              }}
            >
              {zone.logoUrl ? (
                <img src={zone.logoUrl} alt="" />
              ) : (
                (zone.brandLabel ?? "Held").slice(0, 12)
              )}
            </button>
          );
        })}
      </model-viewer>
    </div>
  );
}
