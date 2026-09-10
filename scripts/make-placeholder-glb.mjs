import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function box(w, h, d, x, y, z) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

const merged = mergeGeometries([
  box(0.36, 0.55, 0.22, 0, 1.25, 0),
  box(0.34, 0.16, 0.2, 0, 0.92, 0),
  box(0.14, 0.42, 0.14, -0.1, 0.62, 0),
  box(0.14, 0.42, 0.14, 0.1, 0.62, 0),
  box(0.12, 0.38, 0.12, -0.1, 0.22, 0),
  box(0.12, 0.38, 0.12, 0.1, 0.22, 0),
  box(0.16, 0.12, 0.16, -0.28, 1.46, 0),
  box(0.16, 0.12, 0.16, 0.28, 1.46, 0),
  box(0.12, 0.28, 0.12, -0.38, 1.22, 0),
  box(0.12, 0.28, 0.12, 0.38, 1.22, 0),
  box(0.1, 0.26, 0.1, -0.42, 0.96, 0),
  box(0.1, 0.26, 0.1, 0.42, 0.96, 0),
  box(0.1, 0.12, 0.1, 0, 1.58, 0),
]);

merged.computeVertexNormals();

const position = Buffer.from(merged.attributes.position.array.buffer);
const normal = Buffer.from(merged.attributes.normal.array.buffer);
const indexArray = merged.index.array;
const index =
  indexArray instanceof Uint16Array
    ? Buffer.from(indexArray.buffer)
    : Buffer.from(Uint16Array.from(indexArray).buffer);

function pad(buf, fill = 0) {
  const extra = (4 - (buf.length % 4)) % 4;
  return extra ? Buffer.concat([buf, Buffer.alloc(extra, fill)]) : buf;
}

const bin = pad(Buffer.concat([position, normal, index]));
const posCount = merged.attributes.position.count;
const indexCount = merged.index.count;

const json = {
  asset: { version: "2.0", generator: "skinbid-placeholder" },
  scenes: [{ nodes: [0] }],
  scene: 0,
  nodes: [{ mesh: 0 }],
  meshes: [
    {
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1 },
          indices: 2,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.62, 0.55, 0.48, 1],
        metallicFactor: 0,
        roughnessFactor: 0.85,
      },
    },
  ],
  accessors: [
    {
      bufferView: 0,
      componentType: 5126,
      count: posCount,
      type: "VEC3",
      max: [0.5, 1.7, 0.2],
      min: [-0.5, 0, -0.2],
    },
    {
      bufferView: 1,
      componentType: 5126,
      count: posCount,
      type: "VEC3",
    },
    {
      bufferView: 2,
      componentType: 5123,
      count: indexCount,
      type: "SCALAR",
    },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: position.length, target: 34962 },
    {
      buffer: 0,
      byteOffset: position.length,
      byteLength: normal.length,
      target: 34962,
    },
    {
      buffer: 0,
      byteOffset: position.length + normal.length,
      byteLength: index.length,
      target: 34963,
    },
  ],
  buffers: [{ byteLength: bin.length }],
};

const jsonBuf = pad(Buffer.from(JSON.stringify(json)), 0x20);
const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);

const glb = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, bin]);
const publicDir = path.join(process.cwd(), "public");
mkdirSync(publicDir, { recursive: true });
writeFileSync(path.join(publicDir, "placeholder.glb"), glb);
console.log("Wrote public/placeholder.glb", glb.length, "bytes");

const dracoSrc = path.join(
  process.cwd(),
  "node_modules",
  "three",
  "examples",
  "jsm",
  "libs",
  "draco",
  "gltf",
);
const dracoDest = path.join(publicDir, "draco");
mkdirSync(dracoDest, { recursive: true });
for (const file of [
  "draco_decoder.js",
  "draco_decoder.wasm",
  "draco_wasm_wrapper.js",
]) {
  const from = path.join(dracoSrc, file);
  if (existsSync(from)) {
    copyFileSync(from, path.join(dracoDest, file));
  }
}
console.log("Copied Draco decoder to public/draco");
