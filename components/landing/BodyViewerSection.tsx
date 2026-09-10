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
import EventHud from "@/components/landing/EventHud";
import SlotPitchCard from "@/components/landing/SlotPitchCard";
import WaitlistModal from "@/components/waitlist/WaitlistModal";
import { DEMO_ATHLETES, SLOT_LABELS, type Gender, type SlotId } from "@/lib/demo-landing";
import {
  DRACO_PATH,
  MODEL_SRC,
  POSTER_SRC,
} from "@/lib/landing-media";

type SlotRow = {
  id: SlotId;
  label: string;
};

type BodyFrame = {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

type ModelViewerCtor = typeof ModelViewerElement & {
  dracoDecoderLocation: string;
};

let modelViewerPromise: Promise<ModelViewerCtor> | null = null;

// Start the 3D library now, not after the first paint. Point Draco at our
// local decoder so the page does not wait on Google's CDN.
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
const SLOT_HIT_M = 0.28;

type OrbitPose = {
  theta: number;
  phi: number;
  radius: number;
  target: { x: number; y: number; z: number };
};

// One locked camera pose per zone so the patch sits in the middle of the view.
const SLOT_VIEWS: Record<SlotId, { theta: number; phi: number; radius: number }> =
  {
    "chest-left": { theta: -22, phi: 72, radius: 2.82 },
    "chest-right": { theta: 22, phi: 72, radius: 2.82 },
    "shoulder-left": { theta: -82, phi: 70, radius: 2.78 },
    "shoulder-right": { theta: 82, phi: 70, radius: 2.78 },
    "biceps-left": { theta: -92, phi: 74, radius: 2.72 },
    "biceps-right": { theta: 92, phi: 74, radius: 2.72 },
    abs: { theta: 0, phi: 78, radius: 2.78 },
    "thigh-front-left": { theta: -20, phi: 88, radius: 2.88 },
    "thigh-front-right": { theta: 20, phi: 88, radius: 2.88 },
    "back-left": { theta: -158, phi: 72, radius: 2.88 },
    "back-right": { theta: 158, phi: 72, radius: 2.88 },
    "thigh-back-left": { theta: -162, phi: 88, radius: 2.92 },
    "thigh-back-right": { theta: 162, phi: 88, radius: 2.92 },
  };

// White patches are painted on the GLB. These points only help click detection.
const SLOTS: Array<SlotRow & { x: number; y: number; z: number }> = [
  { id: "chest-left", label: SLOT_LABELS["chest-left"], x: -0.3, y: 0.75, z: 0.48 },
  { id: "chest-right", label: SLOT_LABELS["chest-right"], x: 0.3, y: 0.75, z: 0.48 },
  { id: "shoulder-left", label: SLOT_LABELS["shoulder-left"], x: -0.86, y: 0.83, z: 0.16 },
  { id: "shoulder-right", label: SLOT_LABELS["shoulder-right"], x: 0.86, y: 0.83, z: 0.16 },
  { id: "biceps-left", label: SLOT_LABELS["biceps-left"], x: -0.88, y: 0.7, z: 0.18 },
  { id: "biceps-right", label: SLOT_LABELS["biceps-right"], x: 0.88, y: 0.7, z: 0.18 },
  { id: "abs", label: SLOT_LABELS.abs, x: 0, y: 0.64, z: 0.46 },
  { id: "thigh-front-left", label: SLOT_LABELS["thigh-front-left"], x: -0.42, y: 0.42, z: 0.4 },
  { id: "thigh-front-right", label: SLOT_LABELS["thigh-front-right"], x: 0.42, y: 0.42, z: 0.4 },
  { id: "back-left", label: SLOT_LABELS["back-left"], x: -0.3, y: 0.74, z: -0.48 },
  { id: "back-right", label: SLOT_LABELS["back-right"], x: 0.3, y: 0.74, z: -0.48 },
  { id: "thigh-back-left", label: SLOT_LABELS["thigh-back-left"], x: -0.4, y: 0.42, z: -0.42 },
  { id: "thigh-back-right", label: SLOT_LABELS["thigh-back-right"], x: 0.4, y: 0.42, z: -0.42 },
];

function slotsForGender(gender: Gender) {
  if (gender === "female") {
    return SLOTS.filter((slot) => slot.id !== "chest-left" && slot.id !== "chest-right");
  }
  return SLOTS;
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

function applyPose(viewer: ModelViewerElement, pose: OrbitPose) {
  if (!viewer.isConnected) {
    return;
  }
  viewer.cameraOrbit = poseToOrbit(pose);
  viewer.cameraTarget = poseToTarget(pose);
  viewer.jumpCameraToGoal();
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

function stopViewer(viewer: ModelViewerElement) {
  try {
    viewer.pause();
    viewer.src = "";
  } catch {
    // The 3D tag is already gone.
  }
}

function slotWorld(slot: (typeof SLOTS)[number], frame: BodyFrame) {
  return {
    x: frame.center.x + (slot.x * frame.size.x) / 2,
    y: frame.center.y - frame.size.y / 2 + slot.y * frame.size.y,
    z: frame.center.z + (slot.z * frame.size.z) / 2,
  };
}

// Camera sits on this muscle. Values are written onto the 3D tag so
// React cannot wipe them on the next render.
function slotCameraPose(slotId: SlotId, frame: BodyFrame): OrbitPose {
  const slot = SLOTS.find((item) => item.id === slotId);
  const view = SLOT_VIEWS[slotId];
  const lookY = slot
    ? homeTargetY(frame) * 0.35 + slotWorld(slot, frame).y * 0.65
    : homeTargetY(frame);
  return {
    theta: view.theta,
    phi: view.phi,
    radius: view.radius,
    target: { x: 0, y: lookY, z: 0 },
  };
}

function nearestSlot(
  gender: Gender,
  frame: BodyFrame,
  hit: { x: number; y: number; z: number },
) {
  let best: SlotId | undefined;
  let bestDist = SLOT_HIT_M;
  for (const slot of slotsForGender(gender)) {
    const pos = slotWorld(slot, frame);
    const dx = pos.x - hit.x;
    const dy = pos.y - hit.y;
    const dz = pos.z - hit.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      best = slot.id;
    }
  }
  return best;
}

export default function BodyViewerSection() {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const bodyFrameRef = useRef<BodyFrame>({
    size: { x: 0.55, y: 1.7, z: 0.28 },
    center: { x: 0, y: 0.85, z: 0 },
  });
  const scaledFrameRef = useRef<BodyFrame | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, dragged: false, down: false });
  const activeSlotRef = useRef<SlotId | undefined>(undefined);
  const spinRef = useRef(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [selected, setSelected] = useState<Gender>("male");
  const [spin, setSpin] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotId | undefined>(undefined);
  const [bodyFrame, setBodyFrame] = useState<BodyFrame>({
    size: { x: 0.55, y: 1.7, z: 0.28 },
    center: { x: 0, y: 0.85, z: 0 },
  });
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [overSlot, setOverSlot] = useState(false);

  activeSlotRef.current = activeSlot;
  spinRef.current = spin;

  const cameraIdle = !activeSlot;
  const lockedPose = activeSlot ? slotCameraPose(activeSlot, bodyFrame) : null;
  const lockedOrbit = lockedPose ? poseToOrbit(lockedPose) : undefined;
  const lockedTarget = lockedPose ? poseToTarget(lockedPose) : undefined;

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
      stopViewer(previous);
    }
    viewerRef.current = node;
  }, []);

  function showSlotOnBody(slot: SlotId) {
    const viewer = viewerRef.current;
    const frame = scaledFrameRef.current ?? bodyFrame;
    if (!viewer) {
      return;
    }
    try {
      freezeViewer(viewer);
      lockOrbit(viewer, slotCameraPose(slot, frame));
    } catch (error) {
      console.log("Could not turn body to slot", slot, error);
    }
  }

  // Only one panel at a time: slot card or the slots list.
  function openSlot(slot: SlotId) {
    if (slot === activeSlot) {
      setSlotsOpen(false);
      return;
    }
    setSlotsOpen(false);
    setActiveSlot(slot);
    showSlotOnBody(slot);
    console.log("Opened slot card", slot);
  }

  function closeSlot() {
    setWaitlistOpen(false);
    setActiveSlot(undefined);
  }

  function openSlotsList() {
    setActiveSlot(undefined);
    setWaitlistOpen(false);
    setSlotsOpen(true);
    console.log("Advertise your brand opened slots");
  }

  function closeSlotsList() {
    setSlotsOpen(false);
  }

  function pickGender(next: Gender) {
    setActiveSlot(undefined);
    setSlotsOpen(false);
    setWaitlistOpen(false);
    setModelLoaded(false);
    setSelected(next);
  }

  // Escape closes whichever panel is open. The waitlist popup handles Escape itself.
  useEffect(() => {
    if (waitlistOpen || (!activeSlot && !slotsOpen)) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSlot();
        closeSlotsList();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeSlot, slotsOpen, waitlistOpen]);

  // Keep the chosen muscle facing the camera. This is on the element
  // attributes too, so a React re-render cannot snap back to the chest.
  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !modelLoaded) {
      return;
    }
    if (activeSlot) {
      showSlotOnBody(activeSlot);
      return;
    }
    try {
      viewer.minCameraOrbit = IDLE_ORBIT_MIN;
      viewer.maxCameraOrbit = IDLE_ORBIT_MAX;
      applyPose(viewer, homePose(scaledFrameRef.current ?? bodyFrame));
      viewer.cameraControls = true;
      viewer.interactionPrompt = "auto";
      viewer.autoRotate = spinRef.current;
    } catch (error) {
      console.log("Could not restore home view", error);
    }
  }, [activeSlot, modelLoaded, bodyFrame]);

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
        console.log("Could not frame body", error);
        return;
      }
      if (cancelled || thisLoad !== loadCount || !current.isConnected) {
        return;
      }
      setModelLoaded(true);
      // Male is on screen first. Warm the other body in the background.
      if (selected === "male") {
        void fetch(MODEL_SRC.female, { credentials: "omit" });
      }
    };

    function handleError() {
      console.log("Body viewer failed to load");
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
      // Buttons use the model's own units. Divide out our height scale.
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
      freezeViewer(loadedViewer);
      const slot = activeSlotRef.current;
      if (slot) {
        lockOrbit(loadedViewer, slotCameraPose(slot, scaledFrame));
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
      setBodyFrame(scaledFrame);
      console.log("BodyViewer loaded", selected, "frame", frame);
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
  }, [selected]);

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

  function slotAtPoint(clientX: number, clientY: number) {
    const viewer = viewerRef.current;
    if (!viewer) {
      return undefined;
    }
    const hit = viewer.positionAndNormalFromPoint(clientX, clientY);
    if (hit == null) {
      return undefined;
    }
    const frame = scaledFrameRef.current ?? bodyFrameRef.current;
    return nearestSlot(selected, frame, {
      x: hit.position.x,
      y: hit.position.y,
      z: hit.position.z,
    });
  }

  function syncOverSlot(clientX: number, clientY: number) {
    const next = Boolean(slotAtPoint(clientX, clientY));
    setOverSlot((prev) => (prev === next ? prev : next));
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
    if (waitlistOpen) {
      return;
    }
    const start = pointerRef.current;
    if (start.down) {
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy > 64) {
        start.dragged = true;
      }
    }
    syncOverSlot(event.clientX, event.clientY);
  }

  function onBodyPointerUp(event: ReactPointerEvent) {
    const wasDrag = pointerRef.current.dragged;
    pointerRef.current.down = false;
    if (waitlistOpen || wasDrag) {
      return;
    }
    const slot = slotAtPoint(event.clientX, event.clientY);
    if (slot) {
      openSlot(slot);
    }
  }

  function onBodyPointerLeave() {
    pointerRef.current.down = false;
    setOverSlot(false);
  }

  const visibleSlots = slotsForGender(selected);

  return (
    <section className="body-viewer relative w-full">
      <div className="hud-toggle" role="group" aria-label="Body">
        <div className="hud-gender">
          <button
            type="button"
            aria-pressed={selected === "male"}
            onClick={() => pickGender("male")}
            className={
              selected === "male" ? "press-btn" : "press-btn press-btn-idle"
            }
          >
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Male</span>
          </button>
          <button
            type="button"
            aria-pressed={selected === "female"}
            onClick={() => pickGender("female")}
            className={
              selected === "female" ? "press-btn" : "press-btn press-btn-idle"
            }
          >
            <span className="press-btn-plate" aria-hidden="true" />
            <span className="press-btn-face">Female</span>
          </button>
        </div>
      </div>
      <div className="body-viewer-stage">
        <EventHud
          key={selected}
          athlete={DEMO_ATHLETES[selected]}
          slots={visibleSlots}
          selected={activeSlot}
          slotsOpen={slotsOpen}
          panelOpen={Boolean(activeSlot) || slotsOpen}
          onSelect={openSlot}
          onOpenSlots={openSlotsList}
          onCloseSlots={closeSlotsList}
        />

        <div ref={frameRef} className="body-viewer-frame">
          {!modelLoaded && (
            <>
              <img
                src={POSTER_SRC[selected]}
                alt=""
                width={1280}
                height={675}
                decoding="async"
                className="body-viewer-poster"
              />
              <p className="body-viewer-wait">Loading 3D…</p>
            </>
          )}

          <model-viewer
            ref={bindViewer}
            src={MODEL_SRC[selected]}
            poster={POSTER_SRC[selected]}
            loading="eager"
            reveal="auto"
            camera-controls={cameraIdle}
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
            camera-orbit={lockedOrbit}
            camera-target={lockedTarget}
            min-camera-orbit={lockedOrbit ?? IDLE_ORBIT_MIN}
            max-camera-orbit={lockedOrbit ?? IDLE_ORBIT_MAX}
            interpolation-decay="1"
            interaction-prompt={cameraIdle ? "auto" : "none"}
            auto-rotate={spin && cameraIdle}
            auto-rotate-delay="0"
            rotation-per-second="22deg"
            onPointerDown={onBodyPointerDown}
            onPointerMove={onBodyPointerMove}
            onPointerUp={onBodyPointerUp}
            onPointerLeave={onBodyPointerLeave}
            className={
              overSlot && !waitlistOpen ? "is-over-slot" : undefined
            }
            style={{
              backgroundColor: STUDIO,
              cursor: waitlistOpen
                ? "default"
                : overSlot
                  ? "pointer"
                  : cameraIdle
                    ? "grab"
                    : "default",
            }}
          />

          {activeSlot ? (
            <SlotPitchCard
              label={
                visibleSlots.find((slot) => slot.id === activeSlot)?.label ??
                "Slot"
              }
              onClose={closeSlot}
              onJoinWaitlist={() => setWaitlistOpen(true)}
            />
          ) : null}
        </div>
      </div>
      <WaitlistModal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        slot={activeSlot}
      />
    </section>
  );
}
