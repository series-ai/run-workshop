// Assemble the asset-library leaf (run-bean-squad/3D/characters) from the mobile build:
//
//   node scripts/compress.mjs mobile        # first: rigged/ -> mobile/
//   node scripts/pack.mjs <leaf dir>        # mobile/ + pack/ -> <leaf>/kit, Readme.md, License.txt
//
// <leaf>/kit/            base.glb (skeleton + every clip), face, screen, top, head, topper and number parts
// <leaf>/kit/weapons/    the toy weapons, one GLB each (rig/weapons.py)
// <leaf>/kit/faces/      screen-face masks; kit/numbers/  jersey digits
// <leaf>/kit/beankit.js  the three.js helper, with kit.json and clips.json built in (3D packs ship only
//                        .glb/.png/.jpg plus code, so the catalog lives in the module)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MOBILE = path.join(KIT, 'mobile');
const leaf = process.argv[2];
if (!leaf) {
  console.error('usage: node scripts/pack.mjs <leaf dir>');
  process.exit(1);
}
const out = path.resolve(leaf);
const kitOut = path.join(out, 'kit');
fs.rmSync(kitOut, { recursive: true, force: true });
for (const d of ['weapons', 'faces', 'numbers']) fs.mkdirSync(path.join(kitOut, d), { recursive: true });

let n = 0;
for (const f of fs.readdirSync(path.join(MOBILE, 'glb')).sort()) {
  const dst = f.startsWith('prop-') ? path.join(kitOut, 'weapons', f.slice(5)) : path.join(kitOut, f);
  fs.copyFileSync(path.join(MOBILE, 'glb', f), dst);
  n++;
}
for (const d of ['faces', 'numbers'])
  for (const f of fs.readdirSync(path.join(MOBILE, d)).filter(f => f.endsWith('.png')).sort()) {
    fs.copyFileSync(path.join(MOBILE, d, f), path.join(kitOut, d, f));
    n++;
  }

const kit = JSON.parse(fs.readFileSync(path.join(MOBILE, 'kit.json'), 'utf8'));
const catalog = {
  art_faces: kit.art_faces, led_faces: kit.led_faces, tops: kit.tops, hooded: kit.hooded, heads: kit.heads,
  toppers: kit.toppers, weapons: kit.weapons, defaults: kit.defaults,
  slots: Object.fromEntries(Object.entries(kit.slots).filter(([k]) => k !== 'extra')),
};
delete catalog.defaults.extra;
const clips = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(MOBILE, 'clips.json'), 'utf8')))
  .map(([k, v]) => [k, { duration: v.duration, loop: v.loop, tags: v.tags, ...(v.speed !== undefined ? { speed: v.speed } : {}) }]));
let src = fs.readFileSync(path.join(KIT, 'pack', 'beankit.src.js'), 'utf8');
src = src.replace('/*CATALOG*/{}', JSON.stringify(catalog, null, 1)).replace('/*CLIPS*/{}', JSON.stringify(clips));
fs.writeFileSync(path.join(kitOut, 'beankit.js'), src);
for (const f of ['Readme.md', 'License.txt']) fs.copyFileSync(path.join(KIT, 'pack', f), path.join(out, f));
console.log(`packed ${n} files + beankit.js into ${out}`);
