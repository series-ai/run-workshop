// Lay out "Facet Fauna: Dogs" for the asset library (one 3D/characters leaf):
//
//   <leaf>/breeds/<breed>.glb                 ready-made breeds (kit/breeds)
//   <leaf>/kit/dog_build_<build>.glb          the mix-and-match kit, flat so its
//   <leaf>/kit/dog_head_<head>.glb            pattern masks ship with it (the
//   <leaf>/kit/dog_ear_<ears>_<L|R>.glb       library ships textures that sit
//   <leaf>/kit/dog_tail_<tail>.glb            under a folder holding GLBs)
//   <leaf>/kit/dog_wear_<build>.glb           collar and bandana, fitted to that build
//   <leaf>/kit/patterns/dog_pattern_*.png
//   <leaf>/kit/dogkit.js                      the three.js helper (a game copies it)
//
// Every GLB is meshopt-compressed (EXT_meshopt_compression, animation
// included) with normals and colours quantized; positions stay float (the
// meshes are skinned, and a dequantize transform on a skinned mesh's node
// would be ignored). Loading needs the decoder:
//   loader.setMeshoptDecoder(MeshoptDecoder)  // three/examples/jsm/libs/meshopt_decoder.module.js
//
//   npm install
//   python3 scripts/build_breeds.py           # kit/breeds, and the tables in kit/dogkit.js
//   node scripts/package.mjs <leaf dir>       # e.g. .../run-facet-fauna-dogs/3D/characters
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize, prune } from '@gltf-transform/functions';
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

// The wearables files carry every garment; only the collar and bandana ship.
const WEAR = /^(socket_)?(collar|bandana)(@|\.|$)/;
function onlyCollarAndBandana(doc) {
  for (const node of doc.getRoot().listNodes()) {
    const n = node.getName();
    if ((node.getMesh() || n.startsWith('socket_')) && !WEAR.test(n)) node.dispose();
  }
}

async function compress(src, dst, edit) {
  const doc = await io.read(src);
  if (edit) edit(doc);
  restTracks(doc);
  shortRotations(doc);
  await doc.transform(prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|COLOR_0)$/ }));
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
const kit = f => path.join(leaf, 'kit', f);
for (const b of catalog.builds) {
  jobs.push([path.join(KIT, 'builds', `${b}.glb`), kit(`dog_build_${b}.glb`)]);
  jobs.push([path.join(KIT, 'wearables', `${b}.glb`), kit(`dog_wear_${b}.glb`), onlyCollarAndBandana]);
}
for (const h of catalog.heads) jobs.push([path.join(KIT, 'heads', `${h}.glb`), kit(`dog_head_${h}.glb`)]);
for (const e of catalog.ears) for (const s of ['L', 'R'])
  jobs.push([path.join(KIT, 'parts', `ear-${e}-${s}.glb`), kit(`dog_ear_${e}_${s}.glb`)]);
for (const t of catalog.tails) jobs.push([path.join(KIT, 'parts', `tail-${t}.glb`), kit(`dog_tail_${t}.glb`)]);
let before = 0, after = 0, n = 0;
for (const [src, dst, edit] of jobs) {
  const [a, b] = await compress(src, dst, edit);
  before += a;
  after += b;
  if (++n % 50 === 0) console.log(`${n} / ${jobs.length}`);
}
fs.mkdirSync(kit('patterns'), { recursive: true });
for (const p of Object.values(catalog.patterns)) {
  const kind = p.region ? 'region' : 'tile', key = p.region || p.tile;
  fs.copyFileSync(path.join(KIT, 'patterns', `${kind}-${key}.png`), kit(`patterns/dog_pattern_${kind}_${key}.png`));
}
fs.copyFileSync(path.join(KIT, 'dogkit.js'), kit('dogkit.js'));
console.log(`${jobs.length} GLBs: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
