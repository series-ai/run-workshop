// Package the Wasteland Wheels vehicle kit for the asset library.
//
//   node pack/pack.mjs <build dir> <leaf dir>
//
// <build dir> is a kit/build.py output (kit.json + bodies/ wheels/ parts/ vehicles/).
// The leaf gets the ready-made vehicles, the mix-and-match kit and wheelskit.js
// with the catalogue built in (3D packs ship only .glb, .png and .jpg as data).
// Characters are not part of this pack.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [build, leaf] = process.argv.slice(2);
if (!build || !leaf) throw new Error('usage: node pack/pack.mjs <build dir> <leaf dir>');

const copyDir = (from, to, keep = () => true) => {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  const names = fs.readdirSync(from).filter((n) => n.endsWith('.glb') && keep(n)).sort();
  for (const n of names) fs.copyFileSync(path.join(from, n), path.join(to, n));
  return names.length;
};

const counts = {
  vehicles: copyDir(path.join(build, 'vehicles'), path.join(leaf, 'vehicles')),
  bodies: copyDir(path.join(build, 'bodies'), path.join(leaf, 'kit', 'bodies')),
  wheels: copyDir(path.join(build, 'wheels'), path.join(leaf, 'kit', 'wheels')),
  parts: copyDir(path.join(build, 'parts'), path.join(leaf, 'kit', 'parts')),
};

// the catalogue, without the editor's build stamp and the characters
const kit = JSON.parse(fs.readFileSync(path.join(build, 'kit.json'), 'utf8'));
delete kit.version;
delete kit.raiders;

let src = fs.readFileSync(path.join(here, '..', 'viewer', 'wheels-kit.js'), 'utf8');
const head = `// wheelskit.js: assemble, recolour and animate Wasteland Wheels vehicles in three.js.
//
//   import { WheelsKit } from './wheelskit.js';
//   const kit = await WheelsKit.load('assets/wasteland-wheels/kit/');   // the folder holding bodies/ wheels/ parts/
//   const v = await kit.build({ body: 'icecream', front: 'treads', rear: 'treads', roof: 'cone',
//                               paint: 'sky', trim: 'bone', accent: 'red',
//                               trailers: [{ type: 'tanker', wheels: 'steel', paint: 'red' }] });
//   scene.add(v.group);
//   v.play('accelerate');   // idle | move | accelerate | brake ; v.drop() bounces it
//   v.update(dt);           // every frame
//
// KIT (below) lists every body, wheel kind, bolt-on, trailer and paint. See the Readme.
`;
src = src.replace(/^(\/\/.*\n)+/, head);
src = src.replace("import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';\n",
  "import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';\n\nexport const KIT = " + JSON.stringify(kit, null, 1) + ';\n');
src = src.replace('static async load(base, manifest = null) {', 'static async load(base, manifest = KIT) {');
if (!src.includes('export const KIT') || !src.includes('manifest = KIT')) throw new Error('wheels-kit.js changed: update pack.mjs');
fs.writeFileSync(path.join(leaf, 'kit', 'wheelskit.js'), src);
console.log(JSON.stringify(counts));
