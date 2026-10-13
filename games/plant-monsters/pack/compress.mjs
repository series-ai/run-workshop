// The Terra Tots shipping copies, compressed for phones:
//
//   node pack/compress.mjs <out dir>     reads pack/out/{characters,pots,props,pests}/*.glb (from pack/index.html)
//
// Every GLB is meshopt-compressed (EXT_meshopt_compression, animation included) with normals and colours
// quantized; positions stay float (the limbs are skinned). Baked clips are resampled (keys a straight line between
// their neighbours would give are dropped), store rotations as 16-bit and drop tracks that only hold the rest pose
// (../../tools/glb-tidy.mjs); unused and duplicate data is pruned. Loading needs the decoder:
//   loader.setMeshoptDecoder(MeshoptDecoder)  // three/examples/jsm/libs/meshopt_decoder.module.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../../tools/glb-tidy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) {
  console.error('usage: node pack/compress.mjs <out dir>');
  process.exit(1);
}
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

let before = 0;
let after = 0;
for (const dir of ['characters', 'pots', 'props', 'pests']) {
  const src = path.join(HERE, 'out', dir);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.join(out, dir), { recursive: true });
  let b = 0;
  let a = 0;
  for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.glb')).sort()) {
    const doc = await io.read(path.join(src, f));
    if (doc.getRoot().listAnimations().length) {
      await doc.transform(resample({ tolerance: 1e-4 }));
      restTracks(doc);
      shortRotations(doc);
    }
    await doc.transform(
      dedup(),
      prune(),
      reorder({ encoder: MeshoptEncoder }),
      quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 8, quantizeColor: 8 }),
    );
    doc.createExtension(KHRMeshQuantization).setRequired(true);
    doc.createExtension(EXTMeshoptCompression).setRequired(true)
      .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
    const dst = path.join(out, dir, f);
    fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));
    b += fs.statSync(path.join(src, f)).size;
    a += fs.statSync(dst).size;
  }
  console.log(`${dir}: ${(b / 1e6).toFixed(1)} MB -> ${(a / 1e6).toFixed(1)} MB`);
  before += b;
  after += a;
}
// the kit: the leaf models and limbs the code kit loads (public/assets), as compressed .glb, and the bundled helper
const KIT = [
  ['monstera', (f) => /^monstera_.*\.glb$/.test(f)],
  ['pothos', (f) => /^pothos_(small_C|medium_B|large_A)_1\.glb$/.test(f)],
  ['kit', (f) => /^(sansevieria_leaf|zzplant_leaf)_(small|medium|large)_[ABC]\.gltf$/.test(f)],
  ['body', (f) => /^(arm|leg)\.glb$/.test(f)],
];
{
  let b = 0;
  let a = 0;
  for (const [dir, keep] of KIT) {
    const src = path.join(HERE, '..', 'public', 'assets', dir);
    fs.mkdirSync(path.join(out, 'kit', dir === 'kit' ? 'leaves' : dir), { recursive: true });
    for (const f of fs.readdirSync(src).filter(keep).sort()) {
      const doc = await io.read(path.join(src, f));
      await doc.transform(dedup(), prune(), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|COLOR_0)$/, quantizeNormal: 8, quantizeColor: 8 }));
      doc.createExtension(KHRMeshQuantization).setRequired(true);
      doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
      const dst = path.join(out, 'kit', dir === 'kit' ? 'leaves' : dir, f.replace(/\.gltf$/, '.glb'));
      fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));
      b += fs.statSync(path.join(src, f)).size;
      a += fs.statSync(dst).size;
    }
  }
  const js = path.join(HERE, 'dist', 'terratots.js');
  if (fs.existsSync(js)) fs.copyFileSync(js, path.join(out, 'kit', 'terratots.js'));
  else console.warn('pack/dist/terratots.js missing: run node pack/build-kit.mjs first');
  console.log(`kit: ${(b / 1e6).toFixed(1)} MB -> ${(a / 1e6).toFixed(1)} MB (plus terratots.js)`);
  before += b;
  after += a;
}
console.log(`all: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
