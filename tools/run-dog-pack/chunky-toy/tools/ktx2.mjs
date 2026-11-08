// Mobile build: copies the chunky-toy assets into dist/ with GPU-compressed (KTX2 / Basis)
// textures, which stay compressed in GPU memory (PNG / JPEG are unpacked to full RGBA):
//   - color textures (dog coats, props, bandana default) -> ETC1S, small, inside the GLBs
//     (KHR_texture_basisu)
//   - coat masks and the cloth patterns -> UASTC, high quality (crisp marking edges), .ktx2
// The source files are untouched (the Python pipeline reads the JPEG / PNG originals).
//
//   cd tools && npm install && npm run mobile
//
// Load with three.js KTX2Loader: gltfLoader.setKTX2Loader(ktx2), and
// loadCoats('dist/coats.json', 'dist/rigged/coats/', { ktx2Loader: ktx2 }).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { dedup, prune, quantize, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { tidyJSON } from '../../../glb-tidy.mjs';
import { encodeToKTX2 } from 'ktx2-encoder';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

async function imageDecoder(buf) {
  const b = Buffer.from(buf);
  if (b[0] === 0xff && b[1] === 0xd8) {
    const img = jpeg.decode(b, { useTArray: true, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  }
  const img = PNG.sync.read(b);
  return { width: img.width, height: img.height, data: new Uint8Array(img.data) };
}

const COLOR = { isUASTC: false, qualityLevel: 160, compressionLevel: 2, generateMipmap: true, isPerceptual: true,
  isSetKTX2SRGBTransferFunc: true, imageDecoder };
const DATA = { isUASTC: true, needSupercompression: true, generateMipmap: true, isPerceptual: false,
  isSetKTX2SRGBTransferFunc: false, imageDecoder };

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
// geometry: quantized vertex data (positions 14-bit is plenty at this size), then meshopt
// compression (EXT_meshopt_compression: decode with three's MeshoptDecoder, ~6 KB of wasm)
// meshopt() quantizes too (with its own defaults, 8-bit skin weights: they flatten the
// tails), so the precision goes in here: 16-bit weights keep small tail-root weights intact
const QUANT = { quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12, quantizeWeight: 16 };
// prune keeps skins: clips.glb's skin has no mesh, but without it three doesn't treat its
// nodes as bones, and the clip library loses the rest pose that tails are re-based against
const GEOMETRY = [dedup(), prune({ keepAttributes: true, keepExtras: true, propertyTypes: ['node', 'mesh', 'primitive', 'material', 'texture', 'accessor', 'bufferView'] }),
  quantize(QUANT), meshopt({ encoder: MeshoptEncoder, level: 'medium', ...QUANT })];
const sizes = { glbIn: 0, glbOut: 0, maskIn: 0, maskOut: 0 };

async function glb(src, dst, { animated = false, quant = true } = {}) {
  const doc = await io.read(src);
  if (animated) {   // drop keyframes a linear blend would reproduce, rest-pose tracks, half-size rotations
    // no restTracks() or shortRotations() (glb-tidy.mjs): dogclips.js fits every track to each
    // dog (leg and neck counter-rotations for long bodies), so a track at the Labrador's rest
    // pose still moves on other dogs, and 16-bit rotations drift up to ~1 degree once fitted
    await doc.transform(resample({ tolerance: 1e-4 }));
  }
  else await doc.transform(ktx2(COLOR));
  // wearables are re-bound to the dog's own skeleton at runtime (attachWear), so their
  // vertices must stay in the dog's space: no quantization (it re-scales the mesh node)
  // clips: a skeleton and animations only; no prune (its skin has no mesh and would go,
  // and without it three doesn't make bones, losing the rest pose tails re-base against)
  const steps = animated ? [GEOMETRY[3]] : quant ? GEOMETRY : [GEOMETRY[0], GEOMETRY[1], GEOMETRY[3]];
  await doc.transform(...steps);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, tidyJSON(await io.writeBinary(doc)));
  sizes.glbIn += fs.statSync(src).size;
  sizes.glbOut += fs.statSync(dst).size;
}

// one-channel masks (the fine merle / brindle / roan patterns, at 512 px) as ETC1S: a single
// grey channel survives it well and it's several times smaller; packed masks stay UASTC
const GREY = { isUASTC: false, qualityLevel: 230, compressionLevel: 3, generateMipmap: true, isPerceptual: false,
  isSetKTX2SRGBTransferFunc: false, imageDecoder };
async function dataTexture(src, dst, channels = 4) {
  const opt = channels === 1 ? GREY : { ...DATA, enableRDO: true, rdoQualityLevel: 2 };
  const out = await encodeToKTX2(new Uint8Array(fs.readFileSync(src)), opt);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, out);
  sizes.maskIn += fs.statSync(src).size;
  sizes.maskOut += out.length;
}

const only = process.argv.slice(2);
const want = f => !only.length || only.some(o => f.includes(o));

// dogs, clips, wearables
for (const f of fs.readdirSync(path.join(ROOT, 'rigged')).filter(f => f.endsWith('.glb') && want(f))) {
  if (f === 'clips.glb') { await glb(path.join(ROOT, 'rigged', f), path.join(DIST, 'rigged', f), { animated: true }); console.log('clips'); continue; }
  await glb(path.join(ROOT, 'rigged', f), path.join(DIST, 'rigged', f));
  console.log('dog', f);
}
for (const f of fs.readdirSync(path.join(ROOT, 'rigged', 'wear')).filter(f => f.endsWith('.glb') && want(f))) {
  await glb(path.join(ROOT, 'rigged', 'wear', f), path.join(DIST, 'rigged', 'wear', f), { quant: false });
}
await dataTexture(path.join(ROOT, 'rigged', 'wear', 'cloth.png'), path.join(DIST, 'rigged', 'wear', 'cloth.ktx2'));

// coat masks, and coats.json pointing at them
const coats = JSON.parse(fs.readFileSync(path.join(ROOT, 'coats.json')));
for (const [breed, info] of Object.entries(coats)) {
  for (const m of info.masks) {
    m.ktx2 = m.file.replace(/\.png$/, '.ktx2');
    if (want(breed)) await dataTexture(path.join(ROOT, 'rigged', 'coats', m.file), path.join(DIST, 'rigged', 'coats', m.ktx2), m.channels);
  }
  console.log('masks', breed);
}
fs.writeFileSync(path.join(DIST, 'coats.json'), JSON.stringify(coats));

// props
if (!only.length || only.includes('props')) {
  for (const f of fs.readdirSync(path.join(ROOT, 'props', 'models')).filter(f => f.endsWith('.glb'))) {
    await glb(path.join(ROOT, 'props', 'models', f), path.join(DIST, 'props', 'models', f));
  }
  fs.copyFileSync(path.join(ROOT, 'props', 'props.csv'), path.join(DIST, 'props', 'props.csv'));
}

// the runtime and its data: the kit is self-contained
for (const f of ['dogclips.js', 'dogcoat.js', 'breeds.csv', 'COLORWAYS.md', 'example.html', 'cover.webp', 'preview.webp']) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
fs.copyFileSync(path.join(ROOT, 'KIT.md'), path.join(DIST, 'README.md'));
fs.copyFileSync(path.join(ROOT, 'rigged', 'wear', 'cloth.png'), path.join(DIST, 'rigged', 'wear', 'cloth.png'));

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`GLBs ${kb(sizes.glbIn)} -> ${kb(sizes.glbOut)}; masks ${kb(sizes.maskIn)} -> ${kb(sizes.maskOut)}`);
