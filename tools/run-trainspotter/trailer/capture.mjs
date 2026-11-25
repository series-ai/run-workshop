// Render the trailer page to MP4, frame by frame, with the song.
//
//   node trailer/capture.mjs [--cut a|b] [--stills 1.2,8.9,...] [--from s] [--to s] [--quality High]
//
// Needs a built kit (out/glb), out/trailer/song.m4a and out/trailer/timing.json (trailer/analyse.py).
// Writes out/trailer/trainspotter-trailer.mp4 (1080x1920, 30 fps, H.264 + AAC), or stills as PNGs.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { start } from '../viewer/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'out', 'trailer');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const stills = opt('--stills', null)?.split(',').map(Number);
const quality = opt('--quality', 'High');
const cut = opt('--cut', 'a').toLowerCase(); // a: the original edit; b: wider, more scenic
mkdirSync(outDir, { recursive: true });

const port = 8920 + Math.floor(Math.random() * 60);
const server = await start(port);
const channel = process.env.BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
const angle = { win32: 'd3d11', darwin: 'metal' }[process.platform] ?? 'swiftshader';
const browser = await chromium.launch({ channel, args: [`--use-angle=${angle}`, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${port}/run-trainspotter/trailer/trailer.html?capture&quality=${quality}&cut=${cut}`);
await page.waitForFunction(() => window.__trailer?.ready, null, { timeout: 300000 });
await page.evaluate(() => document.fonts.ready);
const { duration, fps } = await page.evaluate(() => ({ duration: window.__trailer.duration, fps: window.__trailer.fps }));
const stage = page.locator('#stage');

if (stills) {
  for (const t of stills) {
    await page.evaluate((x) => window.__trailer.seek(x), t);
    await stage.screenshot({ path: path.join(outDir, `still-${cut}-${t.toFixed(2)}.png`) });
    console.log('still', t);
  }
} else {
  const from = Number(opt('--from', 0)), to = Math.min(Number(opt('--to', duration)), duration);
  const out = path.join(outDir, cut === 'a' ? 'trainspotter-trailer.mp4' : `trainspotter-trailer-${cut}.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-ss', String(from), '-t', String(to - from), '-i', path.join(outDir, 'song.m4a'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((to - from) * fps);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.__trailer.seek(x), from + i / fps);
    const jpg = await stage.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('wrote', out);
}
writeFileSync(path.join(outDir, 'capture-errors.json'), JSON.stringify(errors, null, 1));
console.log('ERRORS', errors.length ? errors.slice(0, 5) : '[]');
await browser.close();
server.close();
