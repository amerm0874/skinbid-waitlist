import {
  ClampToEdgeWrapping,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Mesh as MeshType,
  type Object3D,
  type Texture,
} from "three";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { defaultHitForZone, slotNormal } from "@/lib/zone-views";
import { ZONE_LAYOUT, type ZoneName } from "@/lib/zones";

const STICKER_PREFIX = "sticker-";
const loader = new TextureLoader();
loader.setCrossOrigin("anonymous");

type BodyFrame = {
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
};

type StickerZone = {
  name: ZoneName;
  logoUrl?: string | null;
};

type CachedSticker = {
  url: string;
  mesh: MeshType;
  material: MeshBasicMaterial;
};

type ViewerStickers = {
  run: number;
  byZone: Map<ZoneName, CachedSticker>;
};

const cache = new WeakMap<object, ViewerStickers>();

function viewerState(viewer: object) {
  let state = cache.get(viewer);
  if (!state) {
    state = { run: 0, byZone: new Map() };
    cache.set(viewer, state);
  }
  return state;
}

function isStickerObject(object: Object3D) {
  let node: Object3D | null = object;
  while (node) {
    if (node.name.startsWith(STICKER_PREFIX)) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function disposeSticker(sticker: CachedSticker) {
  sticker.mesh.removeFromParent();
  sticker.mesh.geometry.dispose();
  sticker.material.map?.dispose();
  sticker.material.dispose();
}

function clearStickers(viewer: object, root: Object3D) {
  const state = cache.get(viewer);
  if (state) {
    for (const sticker of state.byZone.values()) {
      disposeSticker(sticker);
    }
    state.byZone.clear();
  }
  const doomed: Object3D[] = [];
  root.traverse((child) => {
    if (child.name.startsWith(STICKER_PREFIX)) {
      doomed.push(child);
    }
  });
  for (const object of doomed) {
    object.removeFromParent();
  }
}

function prepareMap(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function loadTexture(url: string) {
  return new Promise<Texture>((resolve, reject) => {
    loader.load(url, (texture) => resolve(prepareMap(texture)), undefined, reject);
  });
}

async function loadStickerMap(url: string) {
  try {
    return await loadTexture(url);
  } catch {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`sticker ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadTexture(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

// A decal built around a texture whose bitmap has not finished decoding renders
// empty, and nothing re-flags the material afterwards — so it stays invisible
// until something else happens to dirty the scene. Wait for the decode before
// the decal is ever created.
async function awaitDecode(texture: Texture) {
  const image = texture.image as
    | { decode?: () => Promise<void>; complete?: boolean }
    | undefined;
  if (image && typeof image.decode === "function") {
    try {
      await image.decode();
    } catch {
      // Already decoded, or a source that cannot be decoded explicitly
      // (ImageBitmap); either way it is ready by the time we get here.
    }
  }
  texture.needsUpdate = true;
  return texture;
}

async function loadHostTexture(url: string) {
  return awaitDecode(await loadStickerMap(url));
}

function projectorEuler(normal: Vector3) {
  const helper = new Mesh();
  helper.position.set(0, 0, 0);
  helper.lookAt(normal);
  helper.rotateZ(Math.PI);
  return helper.rotation.clone();
}

// ZONE_LAYOUT pads (abs, thigh) run taller than their actual skin area on a
// real avatar and bleed into the neighboring pad. Cap the decal box so the
// logo stays on its own pad; ZONE_LAYOUT itself (and zone click mapping,
// which reads ZONE_HITS in zone-views.ts, not this) is untouched.
const MAX_PAD_SPAN = 0.2;

function padSize(name: ZoneName) {
  const pad = ZONE_LAYOUT[name];
  return new Vector3(
    Math.min(pad.w, MAX_PAD_SPAN),
    Math.min(pad.h, MAX_PAD_SPAN),
    0.05,
  );
}

function collectMeshes(root: Object3D) {
  const meshes: MeshType[] = [];
  root.traverse((object) => {
    if (isStickerObject(object)) {
      return;
    }
    if ((object as MeshType).isMesh) {
      meshes.push(object as MeshType);
    }
  });
  return meshes;
}

function worldBox(mesh: MeshType) {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox?.clone();
  if (!box) {
    return null;
  }
  box.applyMatrix4(mesh.matrixWorld);
  return box;
}

function meshRadius(mesh: MeshType) {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingSphere();
  const sphere = mesh.geometry.boundingSphere;
  if (!sphere) {
    return 0;
  }
  return sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
}

function largestMesh(meshes: MeshType[]) {
  let best: MeshType | null = null;
  let bestVolume = 0;
  for (const mesh of meshes) {
    const box = worldBox(mesh);
    if (!box) {
      continue;
    }
    const size = box.getSize(new Vector3());
    const volume = Math.abs(size.x * size.y * size.z);
    if (volume > bestVolume) {
      bestVolume = volume;
      best = mesh;
    }
  }
  return best;
}

// The projector must live in the SAME space as bakeWorldMesh's output, which
// bakes vertices through mesh.matrixWorld. viewer.getDimensions()/
// getBoundingBoxCenter() report a different (0..1.7) frame for this avatar, so
// deriving the origin from `frame` puts it outside the baked mesh and
// DecalGeometry returns nothing. Always measure off the same mesh we project on.
function slotOnMesh(mesh: MeshType, hit: ReturnType<typeof defaultHitForZone>) {
  const box = worldBox(mesh);
  if (!box) {
    return new Vector3();
  }
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  return new Vector3(
    center.x + (hit.x * size.x) / 2,
    box.min.y + hit.y * size.y,
    center.z + (hit.z * size.z) / 2,
  );
}

// Clone the body's own material class rather than constructing MeshStandardMaterial
// from our local "three" import: @google/model-viewer bundles its own copy of
// three.js, so a decal built from our import is a cross-module instance the
// renderer silently fails to shade (confirmed live — invisible, no console error).
// Cloning keeps the class the renderer already knows how to draw.
function stickerMaterial(mesh: MeshType, map: Texture) {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const material = (
    source as MeshBasicMaterial & { clone: () => MeshBasicMaterial }
  ).clone();
  material.map = map;
  map.needsUpdate = true;
  material.transparent = true;
  material.alphaTest = 0.05;
  material.depthTest = true;
  material.depthWrite = false;
  material.side = DoubleSide;
  material.toneMapped = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -10;
  material.polygonOffsetUnits = -10;
  const lit = material as MeshBasicMaterial & {
    color?: { set: (n: number) => void };
    emissive?: { set: (n: number) => void };
    emissiveMap?: Texture | null;
    envMap?: unknown;
    metalness?: number;
    roughness?: number;
  };
  lit.color?.set(0xffffff);
  lit.emissive?.set(0x000000);
  if ("emissiveMap" in lit) {
    lit.emissiveMap = null;
  }
  if ("envMap" in lit) {
    lit.envMap = null;
  }
  if ("metalness" in lit) {
    lit.metalness = 0;
  }
  if ("roughness" in lit) {
    lit.roughness = 0.85;
  }
  material.needsUpdate = true;
  return material;
}

function offsetAlongNormal(mesh: MeshType, normal: Vector3, distance: number) {
  const position = mesh.geometry.getAttribute("position");
  const dx = normal.x * distance;
  const dy = normal.y * distance;
  const dz = normal.z * distance;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + dx,
      position.getY(i) + dy,
      position.getZ(i) + dz,
    );
  }
  position.needsUpdate = true;
}

function decalWorldSize(mesh: MeshType) {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) {
    return new Vector3();
  }
  return box.getSize(new Vector3());
}

type SkinMesh = MeshType & {
  isSkinnedMesh?: boolean;
  skeleton?: { update: () => void };
  getVertexPosition?: (index: number, target: Vector3) => Vector3;
};

function bakeWorldMesh(mesh: MeshType) {
  mesh.updateWorldMatrix(true, false);
  const skinned = mesh as SkinMesh;
  skinned.skeleton?.update();
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const vertex = new Vector3();
  for (let i = 0; i < position.count; i++) {
    if (skinned.isSkinnedMesh && skinned.getVertexPosition) {
      skinned.getVertexPosition(i, vertex);
    } else {
      vertex.fromBufferAttribute(position, i);
      vertex.applyMatrix4(mesh.matrixWorld);
    }
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  position.needsUpdate = true;
  const dummy = new (mesh.constructor as typeof Mesh)(geometry, mesh.material);
  dummy.matrixAutoUpdate = false;
  dummy.matrix.identity();
  dummy.matrixWorld.identity();
  return dummy;
}

function adoptHostGeometry(host: MeshType, source: BufferGeometry) {
  const HostGeo = host.geometry.constructor as new () => BufferGeometry;
  const hostAttr = host.geometry.getAttribute("position");
  const HostAttr = hostAttr.constructor as new (
    array: ArrayLike<number>,
    itemSize: number,
  ) => typeof hostAttr;
  const geometry = new HostGeo();
  for (const name of ["position", "normal", "uv"] as const) {
    const attr = source.getAttribute(name);
    if (!attr) {
      continue;
    }
    const data =
      attr.array instanceof Float32Array
        ? attr.array.slice()
        : new Float32Array(attr.array as ArrayLike<number>);
    geometry.setAttribute(name, new HostAttr(data, attr.itemSize));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeDecal(
  mesh: MeshType,
  point: Vector3,
  normal: Vector3,
  size: Vector3,
  map: Texture,
) {
  const baked = bakeWorldMesh(mesh);
  const projectors = [
    point.clone(),
    point.clone().addScaledVector(normal, 0.008),
    point.clone().addScaledVector(normal, -0.008),
  ];
  let decal: MeshType | null = null;
  for (const projector of projectors) {
    const generated = new DecalGeometry(
      baked,
      projector,
      projectorEuler(normal),
      size,
    );
    const count = generated.getAttribute("position")?.count ?? 0;
    if (!count) {
      generated.dispose();
      continue;
    }
    const geometry = adoptHostGeometry(mesh, generated);
    generated.dispose();
    decal = new (mesh.constructor as typeof Mesh)(
      geometry,
      stickerMaterial(mesh, map),
    );
    decal.renderOrder = 12;
    decal.frustumCulled = false;
    decal.matrixAutoUpdate = false;
    decal.matrix.identity();
    offsetAlongNormal(decal, normal, 0.003);
    const span = decalWorldSize(decal);
    if (span.x < size.x * 0.3 && span.y < size.y * 0.3) {
      decal.geometry.dispose();
      (decal.material as MeshBasicMaterial).dispose();
      decal = null;
      continue;
    }
    break;
  }
  baked.geometry.dispose();
  return decal;
}

function glueToHolder(decal: MeshType, holder: Object3D) {
  holder.updateWorldMatrix(true, false);
  decal.geometry.applyMatrix4(holder.matrixWorld.clone().invert());
  holder.add(decal);
}

export async function syncCageStickers(
  root: Object3D,
  zones: StickerZone[],
  frame: BodyFrame,
) {
  // Decal placement measures off the projected mesh itself (slotOnMesh), not
  // this frame — see the note on slotOnMesh for why the two spaces differ.
  void frame;
  root.updateWorldMatrix(true, true);
  const state = viewerState(root);
  const run = ++state.run;
  const wanted = new Map<ZoneName, string>();
  for (const zone of zones) {
    const url = zone.logoUrl?.trim();
    if (url) {
      wanted.set(zone.name, url);
    }
  }

  for (const [name, sticker] of [...state.byZone.entries()]) {
    if (wanted.get(name) === sticker.url) {
      continue;
    }
    disposeSticker(sticker);
    state.byZone.delete(name);
  }

  for (const [name, url] of wanted) {
    if (run !== state.run) {
      return;
    }
    const current = state.byZone.get(name);
    if (current?.url === url) {
      continue;
    }
    let texture: Texture;
    try {
      texture = await loadHostTexture(url);
    } catch (error) {
      console.log("Cage sticker failed", name, error);
      continue;
    }
    if (run !== state.run) {
      texture.dispose();
      return;
    }
    if (current) {
      const old = current.material.map;
      current.material.map = texture;
      current.material.needsUpdate = true;
      current.url = url;
      old?.dispose();
        continue;
    }
    const hit = defaultHitForZone(name);
    const outward = new Vector3(
      slotNormal(hit).x,
      slotNormal(hit).y,
      slotNormal(hit).z,
    ).normalize();
    const meshes = collectMeshes(root);
    const body = largestMesh(meshes);
    if (!body) {
      texture.dispose();
      console.log("Cage sticker missed mesh", name);
      continue;
    }
    const size = padSize(name);
    const world = slotOnMesh(body, hit);
    const decal = makeDecal(body, world, outward, size, texture);
    if (!decal) {
      texture.dispose();
      console.log("Cage sticker empty decal", name);
      continue;
    }
    const span = decalWorldSize(decal);
    decal.name = `${STICKER_PREFIX}${name}`;
    glueToHolder(decal, root);
    state.byZone.set(name, {
      url,
      mesh: decal,
      material: decal.material as MeshBasicMaterial,
    });
    console.log(
      "Cage sticker on",
      name,
      "mesh",
      decal.geometry.getAttribute("position")?.count ?? 0,
      `${span.x.toFixed(3)}x${span.y.toFixed(3)}`,
      body.name || "unnamed",
      meshRadius(body).toFixed(3),
      "tex",
      (texture.image as { width?: number } | undefined)?.width ?? 0,
      "at",
      world.y.toFixed(3),
      "target",
      body.constructor === Mesh ? "sameThree" : "hostThree",
    );
  }

}

export function disposeCageStickers(root: Object3D | null) {
  if (!root) {
    return;
  }
  const state = cache.get(root);
  if (state) {
    state.run += 1;
  }
  clearStickers(root, root);
  cache.delete(root);
}
