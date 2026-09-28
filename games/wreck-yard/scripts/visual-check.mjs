// Captures fixed camera views of the live game and measures frame cost.
// Usage: node scripts/visual-check.mjs <label> [view,view...]
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4400 --strictPort
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const label = process.argv[2] ?? 'current';
const quality = process.env.QUALITY ?? 'high';
const out = path.join(process.env.VISUAL_OUT ?? '/tmp/wreck-visual', label);

/** Fixed views. `null` keeps the player camera at spawn. */
const VIEWS = {
  overview: { pos: [0, 62, 0.01], lookAt: [0, 0, 0] },
  vista: { pos: [2, 8.5, 25], lookAt: [0, 2.2, -8] },
  ramp: { pos: [7.5, 2.6, 7.5], lookAt: [14, 0.2, 0] },
  tank: { pos: [8, 3.4, 6], lookAt: [2.5, 0, 0.5] },
  deck: { pos: [-13, 3.2, 14], lookAt: [-21, 0.6, 7] },
  center: { pos: [-1, 2.6, 5], lookAt: [-4.5, -0.2, -0.8] },
  rig: { pos: [0.5, 3.2, -9], lookAt: [-6, -0.2, -16] },
  'south-wall': { pos: [-3, 3.4, 16], lookAt: [-8, 0, 24] },
  'east-circuit': { pos: [12, 3.2, 3], lookAt: [20, 0, 11] },
  hoop: { pos: [9, 3.4, -12], lookAt: [15, 3.2, -24] },
  conveyor: { pos: [7, 3.5, -5], lookAt: [0, 3.5, -20] },
  catapult: { pos: [3.5, 3.2, 15.5], lookAt: [9, 0.4, 23] },
  // The buggy parks at (14, -12) facing +z (its front is local -z, turned 180°).
  'buggy-front': { pos: [16.6, 0.9, -8.4], lookAt: [14, -0.35, -12] },
  'buggy-side': { pos: [10.2, 0.6, -12.6], lookAt: [14, -0.35, -12] },
  'buggy-rear': { pos: [12.2, 1.4, -16.2], lookAt: [14, -0.35, -12] },
};
const selected = (process.argv[3]?.split(',') ?? Object.keys(VIEWS)).filter((name) => name in VIEWS);

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const summary = { label, quality, created: new Date().toISOString(), views: {}, timing: {} };
try {
  for (const dsf of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dsf });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
    await page.goto(`${base}/?record&quality=${quality}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
    // Orbit mode hides the first-person tool; the camera override still sets the view.
    await page.keyboard.press('KeyO');
    if (dsf === 1) {
      for (const name of selected) {
        const view = VIEWS[name];
        await page.evaluate((v) => window.__SET_CAMERA_OVERRIDE__(v ? v.pos : null, v ? v.lookAt : null), view);
        await page.waitForTimeout(700);
        const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
        const file = path.join(out, `${name}.png`);
        await fs.writeFile(file, Buffer.from(png.split(',')[1], 'base64'));
        summary.views[name] = file;
      }
      await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null, null));
    }
    // Frame cost: render synchronously and wait for the GPU with a 1-pixel read.
    summary.timing[`dsf${dsf}`] = await page.evaluate(() => {
      const { gl, advance } = window.__DEBUG_THREE__;
      window.__SET_CAMERA_OVERRIDE__([2, 8.5, 25], [0, 2.2, -8]);
      const ctx = gl.getContext();
      const pixel = new Uint8Array(4);
      gl.info.autoReset = false;
      const sample = (count) => {
        const times = [];
        for (let i = 0; i < count; i += 1) {
          gl.info.reset();
          const start = performance.now();
          advance(start);
          ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixel);
          times.push(performance.now() - start);
        }
        return times.sort((a, b) => a - b);
      };
      sample(20);
      const times = sample(120);
      return {
        medianMs: times[60], p90Ms: times[108],
        buffer: [ctx.drawingBufferWidth, ctx.drawingBufferHeight],
        drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles,
      };
    });
    summary.timing[`dsf${dsf}`].errors = errors;
    await page.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.timing, null, 1));
