// Assemble the asset-library leaf (run-furries-unleashed/3D/characters) from the Blender pack export:
//
//   Blender -b --factory-startup -t 1 --python scripts/build.py -- wolf kit/anthro-kit-B.glb --variant B --pack /tmp/fu-raw
//   cd pack && npm install && node pack.mjs /tmp/fu-raw <leaf dir>
//
// <leaf>/characters/<species>.glb   the 23 species, ready-made: their own parts and colours, every clip
// <leaf>/kit/base.glb               the bare body, the skeleton and every clip
// <leaf>/kit/<kind>-<name>.glb      one GLB per part (heads, ears, cheeks, hair, eyes, teeth, tails, feet, ...)
// <leaf>/kit/furrykit.js            the three.js helper, with the catalog built in (3D packs ship only
//                                   .glb/.png/.jpg plus code, so the catalog lives in the module)
//
// Every GLB is meshopt-compressed (EXT_meshopt_compression) with quantized normals; clips drop rest-pose
// tracks and store rotations as 16-bit (../../glb-tidy.mjs). Loading needs the meshopt decoder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../glb-tidy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [raw, leafArg] = process.argv.slice(2);
if (!raw || !leafArg) {
  console.error('usage: node pack.mjs <raw export dir> <leaf dir>');
  process.exit(1);
}
const leaf = path.resolve(leafArg);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const defaults = {};   // material (colour region) -> sRGB hex, from the kit's default (wolf) colours
const hex = (lin) => '#' + lin.slice(0, 3).map((c) => Math.round(255 * Math.min(1, Math.max(0, c)) ** (1 / 2.2)).toString(16).padStart(2, '0')).join('');
let clipInfo = null;

async function compress(src, dst, { readColours = false } = {}) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  if (readColours) for (const m of root.listMaterials()) if (!(m.getName() in defaults)) defaults[m.getName()] = hex(m.getBaseColorFactor());
  if (root.listAnimations().length) {
    if (!clipInfo) clipInfo = Object.fromEntries(root.listAnimations().map((a) => [a.getName(),
      Math.max(...a.listSamplers().map((s) => s.getInput().getMax([])[0]))]));
    restTracks(doc);
    shortRotations(doc);
  }
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(NORMAL|TEXCOORD_0)$/, quantizeNormal: 8, quantizeTexcoord: 12 }),
  );
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));
  return [fs.statSync(src).size, fs.statSync(dst).size];
}

for (const d of ['kit', 'characters']) {
  fs.rmSync(path.join(leaf, d), { recursive: true, force: true });
  fs.mkdirSync(path.join(leaf, d), { recursive: true });
}
const totals = {};
for (const d of ['kit', 'characters']) {
  totals[d] = [0, 0];
  for (const f of fs.readdirSync(path.join(raw, d)).filter((f) => f.endsWith('.glb')).sort()) {
    const [a, b] = await compress(path.join(raw, d, f), path.join(leaf, d, f), { readColours: d === 'kit' });
    totals[d] = [totals[d][0] + a, totals[d][1] + b];
  }
  console.log(`${d}: ${fs.readdirSync(path.join(leaf, d)).length} GLBs, ${(totals[d][0] / 1048576).toFixed(2)} MB -> ${(totals[d][1] / 1048576).toFixed(2)} MB`);
}

// the catalog: every part per kind (from the part files), the species presets, colour regions and defaults
const parts = {};
for (const f of fs.readdirSync(path.join(leaf, 'kit')).filter((f) => f.endsWith('.glb') && f.includes('-'))) {
  const [kind, ...rest] = f.slice(0, -4).split('-');
  const name = rest.join('-');
  if (kind === 'claws') continue;
  if (kind === 'teeth') { (parts.teeth ||= new Set()).add(name.split('__')[0]); continue; }
  (parts[kind] ||= new Set()).add(name);
}
const species = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'kit', 'species.json'), 'utf8'));
const catalog = {
  parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, [...v].sort()])),
  species: Object.fromEntries(Object.entries(species.species).map(([sp, r]) => [sp, {
    head: sp, snout: r.snout, ears: r.ears, cheeks: r.cheeks, hair: r.hair, eyes: r.eyes, teeth: r.teeth, tail: r.tail, feet: r.feet,
    tuft: r.tuft !== false, colours: r.colours }])),
  regions: Object.keys(defaults).sort(),
  defaults,
  trails: species.trails || {},
};
const loops = new Set(species.loops || []);
const clips = Object.fromEntries(Object.entries(clipInfo).map(([k, d]) => [k, { duration: +d.toFixed(3), loop: loops.has(k) }]));
let src = fs.readFileSync(path.join(HERE, 'furrykit.src.js'), 'utf8');
src = src.replace('/*CATALOG*/{}', JSON.stringify(catalog, null, 1)).replace('/*CLIPS*/{}', JSON.stringify(clips));
fs.writeFileSync(path.join(leaf, 'kit', 'furrykit.js'), src);
for (const f of ['Readme.md', 'License.txt']) if (fs.existsSync(path.join(HERE, f))) fs.copyFileSync(path.join(HERE, f), path.join(leaf, f));
console.log(`catalog: ${Object.keys(catalog.species).length} species, ${Object.entries(catalog.parts).map(([k, v]) => `${v.length} ${k}`).join(', ')}, ${Object.keys(clips).length} clips`);
