// Meshopt-compressed copies of the GLBs, for shipping (the asset library).
// models/ stays plain glTF, the source of truth the viewer and Blender read.
//
//   npm install
//   node scripts/compress.mjs <out dir> models/*.glb
//
// Vertex positions stay float: quantizing them needs a dequantize transform
// on the mesh's node, and every node here is driven by the clips, so it would
// move each mesh onto a new unnamed child and `getObjectByName('body')` would
// stop being the mesh. Normals and colours are quantized; everything,
// animation included, is meshopt-compressed. Loading needs the decoder:
//   loader.setMeshoptDecoder(MeshoptDecoder)  // three/examples/jsm/libs/meshopt_decoder.module.js
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { reorder, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { restTracks, shortRotations, tidyJSON } from '../../glb-tidy.mjs';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) {
  console.error('usage: node scripts/compress.mjs <out dir> <glb ...>');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });
for (const f of files) {
  const doc = await io.read(f);
  restTracks(doc);
  shortRotations(doc);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(NORMAL|COLOR_0)$/ }));
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  fs.writeFileSync(path.join(out, path.basename(f)), tidyJSON(await io.writeBinary(doc)));
  console.log('WROTE', path.basename(f));
}
