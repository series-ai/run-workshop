// Screenshot the cover and gallery sheets from a packaged leaf.
//
//   node pack/shots.mjs <leaf dir> <out dir> [shot ...]
//
// Starts its own local server (viewer/serve.mjs), drives an installed Edge or
// Chrome through playwright-core (set BROWSER_CHANNEL to pick one), and writes
// <shot>.png per shot plus a .webp of each gallery sheet (ImageMagick `magick`).
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { start } from '../viewer/serve.mjs';

const [leaf, out, ...want] = process.argv.slice(2);
if (!leaf || !out) throw new Error('usage: node pack/shots.mjs <leaf dir> <out dir> [shot ...]');
const shots = want.length ? want : ['cover', 'layout', 'steam', 'traction', 'passenger', 'freight', 'track'];
const SIZES = { cover: [1080, 1080] };
const angle = { win32: 'd3d11', darwin: 'metal' }[process.platform] ?? 'swiftshader';
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
mkdirSync(out, { recursive: true });
const port = 8850 + Math.floor(Math.random() * 100);
const server = await start(port, leaf);
const browser = await chromium.launch({ channel, args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  for (const s of shots) {
    const [w, h] = SIZES[s] ?? [1600, 1100];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => errors.push(`${s}: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${s}: ${m.text()}`));
    await page.goto(`http://127.0.0.1:${port}/run-trainspotter/pack/shots.html?shot=${s}&kit=/leaf/`);
    await page.waitForFunction(() => document.title === 'ready', null, { timeout: 180000 });
    const png = path.join(out, `${s}.png`);
    await page.screenshot({ path: png });
    if (s !== 'cover') execFileSync('magick', [png, '-quality', '88', path.join(out, `${s}.webp`)]);
    console.log('shot', s);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log('ERRORS', JSON.stringify(errors));
process.exit(errors.length ? 1 : 0);
