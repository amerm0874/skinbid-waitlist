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
import { DRACO_PATH, MODEL_SRC, POSTER_SRC } from "@/lib/landing-media";
import {
  defaultHitForZone,
  ZONE_HITS,
  type ZoneHit,
} from "@/lib/zone-views";
import { ZONE_LABEL, ZONE_NAMES, type ZoneName } from "@/lib/zones";

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

export default function ZoneBodyPicker({
  zones,
  onToggle,
}: {
  zones: Record<ZoneName, "open" | "closed">;
  onToggle: (zone: ZoneName) => void;
}) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyFrameRef = useRef<BodyFrame>({
    size: { x: 0.55, y: 1.7, z: 0.28 },
    center: { x: 0, y: 0.85, z: 0 },
  });
  const scaledFrameRef = useRef<BodyFrame | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, dragged: false, down: false });
  const focusRef = useRef<ZoneHit | null>(null);
  const turnRef = useRef<TurnHandle | null>(null);
  const spinRef = useRef(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [focus, setFocus] = useState<ZoneHit | null>(null);
  const [overSlot, setOverSlot] = useState(false);
  const [spin, setSpin] = useState(false);

  focusRef.current = focus;
  spinRef.current = spin;

  function freezeViewer(viewer: ModelViewerElement) {
    if (!viewer.isConnected) {
      return;
    }
    viewer.autoRotate = false;
    viewer.cameraControls = false;
    viewer.interactionPrompt = "none";
  }

  const bindViewer = useCallback((node: ModelViewerElement | null) => {
    const previous = viewerRef.current;
    if (previous && previous !== node) {
      turnRef.current?.cancel();
      turnRef.current = null;
      stopViewer(previous);
    }
    viewerRef.current = node;
  }, []);

  function pickHit(hit: ZoneHit) {
    setFocus(hit);
    onToggle(hit.zone);
    console.log("Zone picked", hit.zone, hit.theta);
  }

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelLoaded) {
      return;
    }
    const frame = scaledFrameRef.current ?? bodyFrameRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const durationMs = reduced ? 0 : TURN_MS;
    turnRef.current?.cancel();

    try {
      freezeViewer(viewer);
      if (focus) {
        const pose = hitCameraPose(focus, frame);
        turnRef.current = turnCamera(viewer, pose, {
          durationMs,
          lock: true,
        });
        console.log("Zone body turning to", focus.zone, poseToOrbit(pose));
      } else {
        turnRef.current = turnCamera(viewer, homePose(frame), {
          durationMs: 0,
          lock: false,
          onIdle: () => {
            viewer.minCameraOrbit = IDLE_ORBIT_MIN;
            viewer.maxCameraOrbit = IDLE_ORBIT_MAX;
            viewer.cameraControls = true;
            viewer.interactionPrompt = "auto";
            viewer.autoRotate = spinRef.current;
          },
        });
      }
    } catch (error) {
      console.log("Could not turn zone camera", focus?.zone ?? "home", error);
    }
    return () => {
      turnRef.current?.cancel();
      turnRef.current = null;
    };
  }, [focus, modelLoaded]);

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

    const handleLoad = async () => {
      const current = viewerRef.current;
      if (cancelled || !current || !current.isConnected) {
        return;
      }
      const thisLoad = ++loadCount;
      try {
        await frameLoadedBody(current);
      } catch (error) {
        console.log("Could not frame zone body", error);
        return;
      }
      if (cancelled || thisLoad !== loadCount || !current.isConnected) {
        return;
      }
      setModelLoaded(true);
    };

    function handleError() {
      console.log("Zone body failed to load");
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
      const scaledFrame: BodyFrame = {
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

      loadedViewer.shadowIntensity = 0.85;
      loadedViewer.shadowSoftness = 1;
      loadedViewer.interpolationDecay = 1;
      const hit = focusRef.current;
      if (hit) {
        freezeViewer(loadedViewer);
        lockOrbit(loadedViewer, hitCameraPose(hit, scaledFrame));
      } else {
        const pose = homePose(scaledFrame);
        loadedViewer.minCameraOrbit = IDLE_ORBIT_MIN;
        loadedViewer.maxCameraOrbit = IDLE_ORBIT_MAX;
        applyPose(loadedViewer, pose);
        loadedViewer.cameraControls = true;
        loadedViewer.interactionPrompt = "auto";
        loadedViewer.autoRotate = spinRef.current;
      }
      bodyFrameRef.current = frame;
      scaledFrameRef.current = scaledFrame;
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
      viewer?.removeEventListener("load", handleLoad);
      viewer?.removeEventListener("error", handleError);
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
    const viewer = viewerRef.current;
    if (!viewer) {
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

  const activeZone = focus?.zone ?? null;
  const activeStatus = activeZone ? zones[activeZone] : null;

  return (
    <div className="zone-body">
      <div ref={frameRef} className="zone-body-frame" aria-label="Body zones">
        {!modelLoaded ? (
          <>
            <img
              src={POSTER_SRC.male}
              alt=""
              width={1280}
              height={675}
              decoding="async"
              className="zone-body-poster"
            />
            <p className="zone-body-wait">Loading 3D…</p>
          </>
        ) : null}

        <model-viewer
          ref={bindViewer}
          src={MODEL_SRC.male}
          poster={POSTER_SRC.male}
          loading="eager"
          reveal="auto"
          camera-controls={!focus}
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
          interaction-prompt={focus ? "none" : "auto"}
          auto-rotate={spin && !focus}
          auto-rotate-delay="0"
          rotation-per-second="22deg"
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerLeave={onBodyPointerLeave}
          className={overSlot ? "is-over-slot" : undefined}
          style={{
            backgroundColor: STUDIO,
            cursor: overSlot ? "pointer" : focus ? "default" : "grab",
          }}
        />

        {activeZone && activeStatus ? (
          <div className="zone-body-hud" aria-live="polite">
            <p className="zone-body-hud-name">{ZONE_LABEL[activeZone]}</p>
            <p
              className={`zone-body-hud-state${
                activeStatus === "closed" ? " is-closed" : ""
              }`}
            >
              {activeStatus === "open" ? "Accepted" : "Locked"}
            </p>
          </div>
        ) : null}
      </div>

      <ul className="zone-body-list" aria-label="Zones">
        {ZONE_NAMES.map((zone) => {
          const open = zones[zone] === "open";
          return (
            <li key={zone}>
              <label className={open ? "is-on" : undefined}>
                <input
                  type="checkbox"
                  name={`zone_${zone}`}
                  checked={open}
                  onChange={() => pickHit(defaultHitForZone(zone))}
                />
                <span>{ZONE_LABEL[zone]}</span>
                <span className="zone-body-list-state">
                  {open ? "Accepted" : "Locked"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
