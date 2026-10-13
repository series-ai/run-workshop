// Write kit/catalog.json (what games see) from the kit constants in kit/kitcore.js,
// so the viewer and the shipped kit can't disagree.
//   node scripts/catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'kit');
const s = fs.readFileSync(path.join(KIT, 'kitcore.js'), 'utf8');
const block = s.slice(s.indexOf('  const BUILDS ='), s.indexOf('  const vert')).replace(/const headFile.*\n/, '');
const c = new Function(`${block};return {BUILDS,HEAD_FILES,HEAD_FOR_BUILD,EARS,TAILS,FURS,COAT_SHELL,PATTERNS,COLOURS,NOSES,SIZE,BUILD_LENGTH};`)();
const catalog = {
  builds: c.BUILDS, heads: c.HEAD_FILES, headForBuild: c.HEAD_FOR_BUILD, ears: c.EARS, tails: c.TAILS, furs: c.FURS,
  coatShell: c.COAT_SHELL, patterns: Object.fromEntries(Object.entries(c.PATTERNS).filter(([, v]) => v)),
  colours: c.COLOURS, noseColours: Object.fromEntries(c.NOSES.map(n => [n, c.COLOURS[n]])),
  sizes: c.SIZE, buildLength: c.BUILD_LENGTH,
  // eye: the eye faces; mouth: inside of the mouth (the head and jaw's back faces)
  fixedColours: { eye: '#151313', mouth: '#a26569' },
  wear: ['collar', 'bandana'],
};
fs.writeFileSync(path.join(KIT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
console.log('wrote kit/catalog.json');
