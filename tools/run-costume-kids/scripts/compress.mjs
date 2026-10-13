// The shipping copies of Boo Brigade's GLBs, compressed for phones:
//
//   <out>/kids/<slug>.glb             the 96 packed kids (previewer/chars)
//   <out>/houses/<part>.glb           the house parts kit + manifest.json (previewer/house-parts)
//   <out>/props/<prop>.glb            houses, cars, street props, candy (neighborhood/glb)
//   <out>/kit/                        the avatar kit: base, items, kit.json, kidkit.js (previewer/kit)
//
// Every GLB is meshopt-compressed (EXT_meshopt_compression, animation included)
// with normals and colours quantized; positions stay float (the kids are skinned,
// and a dequantize transform on a skinned mesh's node would be ignored). Kid clips
// drop tracks that hold the rest pose and store rotations as 16-bit (../glb-tidy.mjs);
// the switch bones (expr.*, bucket) keep their rest scales, so a game still flips them.
// House-part colours keep 16 bits: the house builder finds each part's role colour by
// matching it within 0.02. Loading needs the decoder:
//   loader.setMeshoptDecoder(MeshoptDecoder)  // three/examples/jsm/libs/meshopt_decoder.module.js
//
//   npm install
//   node scripts/compress.mjs <out dir>
//   node scripts/compress.mjs --verify <out dir>   # every clip pose, old vs new
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../glb-tidy.mjs';

const PACK = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const verify = args[0] === '--verify';
const out = verify ? args[1] : args[0];
if (!out) {
  console.error('usage: node scripts/compress.mjs [--verify] <out dir>');
  process.exit(1);
}
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const SETS = [
  { src: 'previewer/chars', dst: 'kids', animated: true, colorBits: 8 },
  { src: 'previewer/house-parts', dst: 'houses', animated: false, colorBits: 16, copy: ['manifest.json'] },
  { src: 'neighborhood/glb', dst: 'props', animated: false, colorBits: 8 },
  // the kit's paint channels are in TEXCOORD_0, which is left as it is
  { src: 'previewer/kit', dst: 'kit', animated: true, colorBits: 8, copy: ['kit.json', 'kidkit.js'] },
];
const glbs = (dir) => fs.readdirSync(path.join(PACK, dir)).filter((f) => f.endsWith('.glb')).sort();

async function compress(src, dst, set) {
  const doc = await io.read(src);
  if (set.animated) {
    restTracks(doc);
    shortRotations(doc);
  }
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 8, quantizeColor: set.colorBits }),
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
    const v = [];
    for (let c = 0; c < n; c++) v.push((a[i * n + c] * (1 - f) + a[j * n + c] * f) * k);
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
  let worst = { rot: 0, lin: 0, missing: 0, file: '' };
  for (const set of SETS.filter((s) => s.animated))
    for (const f of glbs(set.src)) {
      const r = compare(poses(await io.read(path.join(PACK, set.src, f))), poses(await io.read(path.join(out, set.dst, f))));
      if (r.missing) console.log(`${f}: ${r.missing} clips missing`);
      if (r.rot > worst.rot || r.lin > worst.lin) worst = { ...worst, rot: Math.max(worst.rot, r.rot), lin: Math.max(worst.lin, r.lin), file: f };
      worst.missing += r.missing;
    }
  console.log(`worst rotation ${worst.rot.toFixed(3)} deg, worst translation/scale ${worst.lin.toExponential(2)} (${worst.file}), ${worst.missing} clips missing`);
  process.exit(0);
}

let total = [0, 0];
for (const set of SETS) {
  const dir = path.join(out, set.dst);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let sum = [0, 0];
  for (const f of glbs(set.src)) {
    const [a, b] = await compress(path.join(PACK, set.src, f), path.join(dir, f), set);
    sum = [sum[0] + a, sum[1] + b];
  }
  for (const f of set.copy || []) fs.copyFileSync(path.join(PACK, set.src, f), path.join(dir, f));
  console.log(`${set.dst}: ${glbs(set.src).length} GLBs, ${(sum[0] / 1e6).toFixed(1)} MB -> ${(sum[1] / 1e6).toFixed(1)} MB`);
  total = [total[0] + sum[0], total[1] + sum[1]];
}
console.log(`all: ${(total[0] / 1e6).toFixed(1)} MB -> ${(total[1] / 1e6).toFixed(1)} MB`);
