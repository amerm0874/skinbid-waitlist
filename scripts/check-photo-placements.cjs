const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative) {
  const file = path.join(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: (id) => {
    if (id === '@/lib/zones') return load('lib/zones.ts');
    throw new Error(`Unexpected dependency: ${id}`);
  } }, { filename: file });
  return mod.exports;
}

const { drawnPhotoZones, zonePlacement } = load('lib/zone-photos.ts');
const rect = { x: 22, y: 61, w: 9, h: 12 };
const saved = { thigh_l: rect, shoulder_l: rect, shoulder_r: rect, back_r: rect };
assert.equal(drawnPhotoZones('front', { savedOnly: true }).length, 0);
assert.equal(Array.from(drawnPhotoZones('front', { saved, savedOnly: true })).join(','), 'thigh_l');
assert.equal(Array.from(drawnPhotoZones('back', { saved, savedOnly: true })).join(','), 'back_r');
assert.equal(zonePlacement('thigh_l', saved).rect, rect, 'Must preserve athlete coordinates, not defaults');
assert.equal(drawnPhotoZones('front', { saved, savedOnly: true, closed: new Set(['thigh_l']) }).length, 0);
console.log('PASS: manual coordinates, no automatic slots, front/back mapping, shoulders hidden, closed slots hidden.');
