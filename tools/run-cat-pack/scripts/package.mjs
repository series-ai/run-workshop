// Lay out "Facet Fauna: Cats" for the asset library (one 3D/characters leaf):
//
//   <leaf>/breeds/<breed>.glb                ready-made breeds (kit/breeds)
//   <leaf>/kit/cat_build_<build>.glb         the mix-and-match kit, flat so its
//   <leaf>/kit/cat_head_<head>.glb           pattern masks ship with it (the
//   <leaf>/kit/cat_ear_<ears>_<L|R>.glb      library ships textures that sit
//   <leaf>/kit/patterns/cat_pattern_*.png    under a folder holding GLBs)
//   <leaf>/kit/catkit.js                     the three.js helper (a game copies it)
//
// Every GLB is meshopt-compressed (EXT_meshopt_compression, animation
// included) with normals and colours quantized; positions stay float (the
// meshes are skinned, and a dequantize transform on a skinned mesh's node
// would be ignored). Loading needs the decoder:
//   loader.setMeshoptDecoder(MeshoptDecoder)  // three/examples/jsm/libs/meshopt_decoder.module.js
//
//   npm install
//   node scripts/package.mjs <leaf dir>       # e.g. .../run-facet-fauna-cats/3D/characters
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../glb-tidy.mjs';

const PACK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KIT = path.join(PACK, 'kit');
const [leaf] = process.argv.slice(2);
if (!leaf) {
  console.error('usage: node scripts/package.mjs <leaf dir>');
  process.exit(1);
}
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

async function compress(src, dst) {
  const doc = await io.read(src);
  restTracks(doc);
  shortRotations(doc);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|COLOR_0)$/ }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));
  return [fs.statSync(src).size, fs.statSync(dst).size];
}

const catalog = JSON.parse(fs.readFileSync(path.join(KIT, 'catalog.json'), 'utf8'));
for (const d of ['breeds', 'kit']) fs.rmSync(path.join(leaf, d), { recursive: true, force: true });
const jobs = [];
for (const f of fs.readdirSync(path.join(KIT, 'breeds')).filter(f => f.endsWith('.glb')))
  jobs.push([path.join(KIT, 'breeds', f), path.join(leaf, 'breeds', f)]);
for (const b of catalog.builds) jobs.push([path.join(KIT, 'builds', `${b}.glb`), path.join(leaf, 'kit', `cat_build_${b}.glb`)]);
for (const h of catalog.heads) jobs.push([path.join(KIT, 'heads', `${h}.glb`), path.join(leaf, 'kit', `cat_head_${h}.glb`)]);
for (const e of catalog.ears) for (const s of ['L', 'R'])
  jobs.push([path.join(KIT, 'parts', `ear-${e}-${s}.glb`), path.join(leaf, 'kit', `cat_ear_${e}_${s}.glb`)]);
let before = 0, after = 0;
for (const [src, dst] of jobs) {
  const [a, b] = await compress(src, dst);
  before += a;
  after += b;
}
fs.mkdirSync(path.join(leaf, 'kit', 'patterns'), { recursive: true });
for (const p of Object.values(catalog.patterns)) {
  const kind = p.region ? 'region' : 'tile', key = p.region || p.tile;
  fs.copyFileSync(path.join(KIT, 'patterns', `${kind}-${key}.png`), path.join(leaf, 'kit', 'patterns', `cat_pattern_${kind}_${key}.png`));
}
fs.copyFileSync(path.join(KIT, 'catkit.js'), path.join(leaf, 'kit', 'catkit.js'));
console.log(`${jobs.length} GLBs: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
