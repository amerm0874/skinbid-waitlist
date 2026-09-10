"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { ZONE_LAYOUT, type ZoneName } from "@/lib/zones";

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

export default function EventCage({ glbUrl, zones, selected, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  onSelectRef.current = onSelect;
  selectedRef.current = selected;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const el = host;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);

    const camera = new THREE.PerspectiveCamera(
      38,
      el.clientWidth / Math.max(el.clientHeight, 1),
      0.1,
      80,
    );
    camera.position.set(2.4, 1.6, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.0, 0);
    controls.minDistance = 1.4;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.49;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(2, 4, 3);
    scene.add(key);

    scene.add(buildCage());

    const zoneGroup = new THREE.Group();
    scene.add(zoneGroup);
    const zoneMeshes: THREE.Mesh[] = [];

    for (const zone of zones) {
      const layout = ZONE_LAYOUT[zone.name];
      const geometry = new THREE.BoxGeometry(layout.w, layout.h, layout.d);
      const idle = zone.occupied ? 0xf2f2f0 : 0xc8f24e;
      const material = new THREE.MeshBasicMaterial({
        color: idle,
        wireframe: true,
        transparent: true,
        opacity: zone.status === "closed" ? 0.12 : 0.95,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(layout.x, layout.y, layout.z);
      mesh.userData.zoneName = zone.name;
      mesh.userData.idle = idle;
      zoneGroup.add(mesh);
      zoneMeshes.push(mesh);

      if (zone.occupied) {
        const decal = makeLogoPlane(zone.brandLabel ?? "BID", zone.logoUrl);
        decal.position.set(layout.x, layout.y, layout.z + layout.d / 2 + 0.01);
        zoneGroup.add(decal);
      }
    }

    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      glbUrl,
      (gltf) => {
        const model = gltf.scene;
        fitModel(model);
        scene.add(model);
      },
      undefined,
      (error) => {
        console.log("GLB load failed, using cage only", error);
      },
    );

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function onPointer(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(zoneMeshes, false)[0];
      const name = hit?.object.userData.zoneName as ZoneName | undefined;
      if (name) {
        onSelectRef.current(name);
      }
    }

    renderer.domElement.addEventListener("pointerup", onPointer);

    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      controls.update();
      for (const mesh of zoneMeshes) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        const name = mesh.userData.zoneName as ZoneName;
        mat.color.setHex(
          name === selectedRef.current ? 0xffffff : mesh.userData.idle,
        );
      }
      renderer.render(scene, camera);
    }
    tick();

    function onResize() {
      camera.aspect = el.clientWidth / Math.max(el.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerup", onPointer);
      controls.dispose();
      draco.dispose();
      renderer.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [glbUrl, zones]);

  return (
    <div
      ref={hostRef}
      className="h-[70svh] min-h-[360px] w-full border-b border-line bg-bg md:h-[calc(100svh-52px)] md:border-b-0 md:border-r"
    />
  );
}

function buildCage() {
  const group = new THREE.Group();
  const edge = new THREE.LineBasicMaterial({ color: 0xc8f24e });
  const dim = new THREE.LineBasicMaterial({ color: 0x2a2a2e });
  const box = new THREE.BoxGeometry(3.2, 3.4, 3.2);
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(box), edge);
  cage.position.y = 1.5;
  group.add(cage);
  group.add(new THREE.GridHelper(3.2, 8, 0x2a2a2e, 0x2a2a2e));
  for (const [x, z] of [
    [-1.6, -1.6],
    [1.6, -1.6],
    [-1.6, 1.6],
    [1.6, 1.6],
  ] as const) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0, z),
      new THREE.Vector3(x, 3.2, z),
    ]);
    group.add(new THREE.Line(geo, dim));
  }
  return group;
}

function fitModel(root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = 1.7 / Math.max(size.y, 0.001);
  root.scale.multiplyScalar(scale);
  root.position.sub(center.multiplyScalar(scale));
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y -= fitted.min.y;
}

function makeLogoPlane(label: string, logoUrl?: string | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f2f2f0";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#0b0b0c";
    ctx.font = "700 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.slice(0, 8).toUpperCase(), 128, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), mat);
  if (logoUrl) {
    new THREE.TextureLoader().load(logoUrl, (map) => {
      mat.map = map;
      mat.needsUpdate = true;
    });
  }
  return mesh;
}
