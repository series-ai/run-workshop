// The mobile copies of the bean kit's rigged GLBs (rigged/ -> <out>/):
//
//   <out>/glb/*.glb     every part, meshopt-compressed (EXT_meshopt_compression, animation included),
//                       normals and colours quantized, positions float (skinned meshes)
//   <out>/kit.json, clips.json, faces/   copied as they are
//
// base.glb's clips drop tracks that hold the rest pose and store rotations as 16-bit (../../glb-tidy.mjs).
// Loading needs the decoder:  loader.setMeshoptDecoder(MeshoptDecoder)
//   (three/examples/jsm/libs/meshopt_decoder.module.js)
//
//   npm install
//   node scripts/compress.mjs mobile
//   node scripts/compress.mjs --verify mobile      # every clip pose, rigged/ vs mobile/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../../glb-tidy.mjs';

const KIT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(KIT, 'rigged');
const args = process.argv.slice(2);
const verify = args[0] === '--verify';
const out = path.resolve(KIT, verify ? args[1] : args[0] || '');
if (!(verify ? args[1] : args[0])) {
  console.error('usage: node scripts/compress.mjs [--verify] <out dir>');
  process.exit(1);
}
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const glbs = () => fs.readdirSync(path.join(SRC, 'glb')).filter((f) => f.endsWith('.glb')).sort();

async function compress(src, dst) {
  const doc = await io.read(src);
  if (doc.getRoot().listAnimations().length) {
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

// ---------- verify: sample every clip on its keyframes, old file against new ----------
function sampler(ch) {
  const s = ch.getSampler(), inp = s.getInput().getArray(), o = s.getOutput();
  const a = o.getArray(), n = o.getElementSize(), k = o.getNormalized() ? 1 / 32767 : 1;
  const step = s.getInterpolation() === 'STEP';
  return (t) => {
    let i = 0;
    while (i < inp.length - 1 && inp[i + 1] <= t) i++;
    const j = Math.min(i + 1, inp.length - 1);
    const f = step || j === i ? 0 : Math.min(1, Math.max(0, (t - inp[i]) / (inp[j] - inp[i])));
    // q and -q are the same rotation (int16 storage may flip the sign): align before blending
    let sgn = 1;
    if (n === 4) { let d = 0; for (let c = 0; c < 4; c++) d += a[i * 4 + c] * a[j * 4 + c]; if (d < 0) sgn = -1; }
    const v = [];
    for (let c = 0; c < n; c++) v.push((a[i * n + c] * (1 - f) + sgn * a[j * n + c] * f) * k);
    return v;
  };
}
function poses(doc) {         // clip -> node name -> path -> (t -> value), plus each node's rest
  const clips = new Map(), rest = new Map();
  for (const node of doc.getRoot().listNodes())
    rest.set(node.getName(), { translation: node.getTranslation(), rotation: node.getRotation(), scale: node.getScale() });
  for (const anim of doc.getRoot().listAnimations()) {
    const m = new Map();
    let end = 0;
    for (const ch of anim.listChannels()) {
      const name = ch.getTargetNode().getName();
      if (!m.has(name)) m.set(name, {});
      m.get(name)[ch.getTargetPath()] = sampler(ch);
      end = Math.max(end, ch.getSampler().getInput().getMax([])[0]);
    }
    clips.set(anim.getName(), { tracks: m, end });
  }
  return { clips, rest };
}
const unit = (q) => { const l = Math.hypot(...q); return q.map((x) => x / l); };
function compare(a, b) {      // worst rotation (degrees) and translation/scale difference
  let rot = 0, lin = 0, missing = 0;
  for (const [clip, { tracks, end }] of a.clips) {
    const other = b.clips.get(clip);
    if (!other) { missing++; continue; }
    for (let t = 0; t <= end + 1e-6; t += 1 / 30) {
      for (const [name, rest] of a.rest) {
        for (const p of ['translation', 'rotation', 'scale']) {
          const va = tracks.get(name)?.[p]?.(t) ?? rest[p];
          const vb = other.tracks.get(name)?.[p]?.(t) ?? b.rest.get(name)[p];
          if (p === 'rotation') {
            const d = Math.abs(unit(va).reduce((s, x, i) => s + x * unit(vb)[i], 0));
            rot = Math.max(rot, (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI);
          } else lin = Math.max(lin, ...va.map((x, i) => Math.abs(x - vb[i])));
        }
      }
    }
  }
  return { rot, lin, missing };
}


if (verify) {
  const r = compare(poses(await io.read(path.join(SRC, 'glb', 'base.glb'))), poses(await io.read(path.join(out, 'glb', 'base.glb'))));
  console.log(`base.glb: worst rotation ${r.rot.toFixed(3)} deg, worst translation/scale ${r.lin.toExponential(2)}, ${r.missing} clips missing`);
  process.exit(0);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'glb'), { recursive: true });
let total = [0, 0];
for (const f of glbs()) {
  const [a, b] = await compress(path.join(SRC, 'glb', f), path.join(out, 'glb', f));
  total = [total[0] + a, total[1] + b];
  console.log(`${f.padEnd(26)} ${(a / 1024).toFixed(0).padStart(6)} KB -> ${(b / 1024).toFixed(0).padStart(5)} KB`);
}
for (const f of ['kit.json', 'clips.json']) fs.copyFileSync(path.join(SRC, f), path.join(out, f));
fs.cpSync(path.join(SRC, 'faces'), path.join(out, 'faces'), { recursive: true });
fs.cpSync(path.join(SRC, 'numbers'), path.join(out, 'numbers'), { recursive: true });
console.log(`total ${(total[0] / 1048576).toFixed(2)} MB -> ${(total[1] / 1048576).toFixed(2)} MB`);
