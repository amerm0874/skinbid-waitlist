"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export type BodyFrame = {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

export type CameraPose = {
  theta: number;
  phi: number;
  radius: number;
  target: { x: number; y: number; z: number };
};

export type BodyCanvasHandle = {
  /** glTF root, in the space cage-stickers bakes against. */
  getRoot: () => Object3D | null;
  getFrame: () => BodyFrame | null;
  /** World-space point under the cursor, or null when the ray misses. */
  raycast: (clientX: number, clientY: number) => Vector3 | null;
  /** Jump the camera, no animation. */
  applyPose: (pose: CameraPose) => void;
  readPose: () => CameraPose | null;
  /** Pin polar + distance, leave azimuth free (today's zone-focus lock). */
  lockVertical: (pose: CameraPose) => void;
  /** Widen limits so an animated turn can move through them. */
  unlockTravel: () => void;
};

type Props = {
  src: string;
  targetHeight: number;
  fovDeg: number;
  background: string;
  exposure: number;
  className?: string;
  style?: React.CSSProperties;
  onLoaded: (frame: BodyFrame) => void;
  onError?: () => void;
  onPointerDown?: (event: ReactPointerEvent) => void;
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: (event: ReactPointerEvent) => void;
  onPointerLeave?: () => void;
};

function poseToPosition(pose: CameraPose) {
  const phi = (pose.phi * Math.PI) / 180;
  const theta = (pose.theta * Math.PI) / 180;
  const r = pose.radius;
  return new Vector3(
    pose.target.x + r * Math.sin(phi) * Math.sin(theta),
    pose.target.y + r * Math.cos(phi),
    pose.target.z + r * Math.sin(phi) * Math.cos(theta),
  );
}

const BodyCanvas = forwardRef<BodyCanvasHandle, Props>(function BodyCanvas(
  {
    src,
    targetHeight,
    fovDeg,
    background,
    exposure,
    className,
    style,
    onLoaded,
    onError,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rootRef = useRef<Object3D | null>(null);
  const frameRef = useRef<BodyFrame | null>(null);
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);

  onLoadedRef.current = onLoaded;
  onErrorRef.current = onError;

  useImperativeHandle(
    ref,
    (): BodyCanvasHandle => ({
      getRoot: () => rootRef.current,
      getFrame: () => frameRef.current,
      raycast: (clientX, clientY) => {
        const host = hostRef.current;
        const camera = cameraRef.current;
        const root = rootRef.current;
        if (!host || !camera || !root) {
          return null;
        }
        const rect = host.getBoundingClientRect();
        const ndc = new Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new Raycaster();
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObject(root, true)[0];
        return hit ? hit.point.clone() : null;
      },
      applyPose: (pose) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
          return;
        }
        controls.target.set(pose.target.x, pose.target.y, pose.target.z);
        camera.position.copy(poseToPosition(pose));
        camera.lookAt(controls.target);
        controls.update();
      },
      readPose: () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
          return null;
        }
        return {
          theta: (controls.getAzimuthalAngle() * 180) / Math.PI,
          phi: (controls.getPolarAngle() * 180) / Math.PI,
          radius: camera.position.distanceTo(controls.target),
          target: {
            x: controls.target.x,
            y: controls.target.y,
            z: controls.target.z,
          },
        };
      },
      lockVertical: (pose) => {
        const controls = controlsRef.current;
        if (!controls) {
          return;
        }
        const phi = (pose.phi * Math.PI) / 180;
        controls.minPolarAngle = phi;
        controls.maxPolarAngle = phi;
        controls.minDistance = pose.radius;
        controls.maxDistance = pose.radius;
        controls.minAzimuthAngle = -Infinity;
        controls.maxAzimuthAngle = Infinity;
        controls.update();
      },
      unlockTravel: () => {
        const controls = controlsRef.current;
        if (!controls) {
          return;
        }
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
        controls.minDistance = 0.1;
        controls.maxDistance = 100;
        controls.update();
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) {
      return;
    }

    let disposed = false;
    let raf = 0;

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new Scene();
    scene.background = new Color(background);
    sceneRef.current = scene;

    const pmrem = new PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new PerspectiveCamera(
      fovDeg,
      (host.clientWidth || 1) / (host.clientHeight || 1),
      0.01,
      100,
    );
    camera.position.set(0, 1, 4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.set(0, 0.85, 0);
    controls.update();
    controlsRef.current = controls;

    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      src,
      (gltf) => {
        if (disposed) {
          return;
        }
        const root = gltf.scene;
        // Normalise to the same standing height model-viewer was scaled to.
        const raw = new Box3().setFromObject(root);
        const rawSize = raw.getSize(new Vector3());
        const scale = rawSize.y > 0 ? targetHeight / rawSize.y : 1;
        root.scale.setScalar(scale);
        root.updateMatrixWorld(true);

        // Sit the feet on y=0 and centre on x/z, matching the old framing.
        const box = new Box3().setFromObject(root);
        const center = box.getCenter(new Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= box.min.y;
        root.updateMatrixWorld(true);

        const finalBox = new Box3().setFromObject(root);
        const size = finalBox.getSize(new Vector3());
        const finalCenter = finalBox.getCenter(new Vector3());
        const frame: BodyFrame = {
          size: { x: size.x, y: size.y, z: size.z },
          center: { x: finalCenter.x, y: finalCenter.y, z: finalCenter.z },
        };

        scene.add(root);
        rootRef.current = root;
        frameRef.current = frame;
        onLoadedRef.current(frame);
      },
      undefined,
      (error) => {
        console.log("Cage body failed to load", error);
        onErrorRef.current?.();
      },
    );

    // Continuous loop. One ~34k-tri mesh is cheap, and on-demand rendering is
    // exactly the failure mode this migration exists to remove: a decal added
    // to the scene graph must never depend on something else scheduling a frame.
    const tick = () => {
      if (disposed) {
        return;
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      draco.dispose();
      pmrem.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
      rootRef.current = null;
      frameRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [src, targetHeight, fovDeg, background, exposure]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ ...style, touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    />
  );
});

export default BodyCanvas;
