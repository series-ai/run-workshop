// Screenshot the cover and gallery sheets: node pack/shots.mjs <kit url path> <out dir> [shot ...]
// Needs ~/Documents/GitHub served on :8830 (python3 -m http.server 8830 --bind 127.0.0.1) and Playwright
// (resolved from games/run-voxel-showcase, or set PLAYWRIGHT_DIR). <kit url path> is the leaf's kit/
// folder under that server, e.g. /jam-ready-assets-wasteland/run-wasteland-wheels/3D/vehicles-racing/kit/
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(path.resolve(process.env.PLAYWRIGHT_DIR || new URL('../../../games/run-voxel-showcase/', import.meta.url).pathname) + '/');
const { chromium } = require('playwright');
const [kit, out, ...want] = process.argv.slice(2);
const SIZES = { cover: [1080, 1080] };
const shots = want.length ? want : ['cover', 'lineup', 'mix', 'wheels', 'parts', 'trailers'];
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errs = [];
for (const s of shots) {
  const [w, h] = SIZES[s.split('@')[0]] || [1600, 1100];
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errs.push(`${s}: ${e}`));
  p.on('console', (m) => m.type() === 'error' && errs.push(`${s}: ${m.text()}`));
  await p.goto(`http://127.0.0.1:8830/run-workshop/tools/run-monster-trucks/pack/shots.html?shot=${s.split('@')[0]}&kit=${kit}${s.includes('@') ? '&font=' + s.split('@')[1] : ''}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(out, `${s.replace('@', '-')}.png`) });
  console.log('shot', s);
  await p.close();
}
console.log('ERRORS', JSON.stringify(errs));
await b.close();
