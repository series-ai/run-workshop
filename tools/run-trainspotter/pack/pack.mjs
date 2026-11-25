// Package a Trainspotter build into the asset library leaf.
//
//   node pack/pack.mjs <build dir> <leaf dir>
//
// <build dir> is a kit/build.py output, finalized by lint/glb.mjs (kit.json
// plus one subfolder per family). The leaf gets every GLB in its subfolder and
// the three.js helper in helper/: trainkit.js with the catalogue built in,
// trackpath.js, the engine-free path maths, trainfx.js, the particle
// effects, and driver.js, station stops, shuttles and signals. 3D packs ship only .glb, .png and
// .jpg as runtime data, so kit.json itself is not copied.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [build, leaf] = process.argv.slice(2);
if (!build || !leaf) throw new Error('usage: node pack/pack.mjs <build dir> <leaf dir>');

const kit = JSON.parse(fs.readFileSync(path.join(build, 'kit.json'), 'utf8'));
delete kit.version; // the editor's cache stamp
const files = Object.values(kit).filter((s) => s && typeof s === 'object').flatMap((s) => Object.values(s)).filter((e) => e?.file).map((e) => e.file);
const folders = [...new Set(files.map((f) => f.split('/')[0]))];
for (const f of [...folders, 'helper']) fs.rmSync(path.join(leaf, f), { recursive: true, force: true });
for (const f of files) {
  const src = path.join(build, f);
  const finalized = fs.readFileSync(src).toString('latin1').includes('run-voxel-packs (Blender glTF exporter + finalize)');
  if (!finalized) throw new Error(`${f} is not finalized: run lint/glb.mjs on the build first`);
  fs.mkdirSync(path.join(leaf, path.dirname(f)), { recursive: true });
  fs.copyFileSync(src, path.join(leaf, f));
}

const helper = path.join(leaf, 'helper');
fs.mkdirSync(helper, { recursive: true });
let src = fs.readFileSync(path.join(here, '..', 'viewer', 'train-kit.js'), 'utf8').replace(/\r\n/g, '\n'); // tolerate a CRLF checkout
src = src.replace('// train-kit.js: lay track', '// trainkit.js: lay track')
  .replace("TrainKit.load('assets/trainspotter/');            // the folder holding the GLB subfolders",
    "TrainKit.load('assets/trainspotter/');            // the pack folder (holding railway-track/, steam-locomotives/, ...)")
  .replace("from './train-fx.js';", "from './trainfx.js';");
if (!src.includes("from './trainfx.js';")) throw new Error('train-kit.js no longer re-exports train-fx.js: update pack.mjs');
const anchor = "export * from './trackpath.js';\n";
if (!src.includes(anchor) || !src.includes('static async load(base, manifest = null) {')) throw new Error('train-kit.js changed: update pack.mjs');
src = src.replace(anchor, `${anchor}\n// The catalogue: every model's file, couplers, guides, wheels, colour roles, and every\n// track piece's connectors and routes (voxels; headings in degrees, 0 = -Z).\nexport const KIT = ${JSON.stringify(kit, null, 1)};\n`);
src = src.replace('static async load(base, manifest = null) {', 'static async load(base, manifest = KIT) {');
fs.writeFileSync(path.join(helper, 'trainkit.js'), src);
fs.copyFileSync(path.join(here, '..', 'viewer', 'trackpath.js'), path.join(helper, 'trackpath.js'));
fs.copyFileSync(path.join(here, '..', 'viewer', 'train-fx.js'), path.join(helper, 'trainfx.js'));
fs.copyFileSync(path.join(here, '..', 'viewer', 'driver.js'), path.join(helper, 'driver.js')); // station stops, shuttles, signals
const audioSrc = fs.readFileSync(path.join(here, '..', 'viewer', 'train-audio.js'), 'utf8').replace("from './train-fx.js';", "from './trainfx.js';");
if (/from '\.\/(?!trainfx\.js')/.test(audioSrc)) throw new Error('train-audio.js imports a viewer module: update pack.mjs');
fs.writeFileSync(path.join(helper, 'trainaudio.js'), audioSrc); // sound effects (they play the pack's audio folder)
console.log(JSON.stringify({ glb: files.length, folders }));
