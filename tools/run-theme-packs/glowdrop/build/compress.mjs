// Meshopt-compressed shipping copies of every GLB in <src>, same folder layout, into <dst>.
// Same recipe as the other RUN packs (run-dice-animals/scripts/compress.mjs + tools/glb-tidy.mjs):
// rest tracks dropped, 16-bit rotations, quantized normals, meshopt on everything, tidy JSON.
// Positions stay float: every animated part is a node the clips drive.
// Loading needs the decoder: loader.setMeshoptDecoder(MeshoptDecoder).
//
//   npm install && node compress.mjs out ship
import fs from 'node:fs';
import path from 'node:path';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../../glb-tidy.mjs';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .setLogger(new Logger(Logger.Verbosity.WARN))
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const [src, dst] = process.argv.slice(2);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.glb') ? [path.join(d, e.name)] : []);
let before = 0, after = 0;
for (const f of walk(src)) {
  const doc = await io.read(f);
  restTracks(doc);
  shortRotations(doc);
  // keepLeaves: socket empties such as a stem's `cap` node must survive pruning
  await doc.transform(dedup(), prune({ keepLeaves: true }), reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL)$/ }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const outPath = path.join(dst, path.relative(src, f));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const bytes = tidyJSON(await io.writeBinary(doc));
  fs.writeFileSync(outPath, bytes);
  before += fs.statSync(f).size; after += bytes.length;
}
console.log(`compressed ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB`);
