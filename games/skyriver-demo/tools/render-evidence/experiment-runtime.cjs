'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
function write(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function args() { const result = {}; for (let i = 2; i < process.argv.length; i += 2) { if (!process.argv[i].startsWith('--') || process.argv[i + 1] === undefined) throw Error('Use named arguments.'); result[process.argv[i].slice(2)] = process.argv[i + 1]; } return result; }
function gpuLock(owner) { const file = '/tmp/skyriver-proof-gpu.lock'; const fd = fs.openSync(file, 'wx'); fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, owner })); fs.closeSync(fd); return () => fs.unlinkSync(file); }
async function open(url, out) {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    fs.mkdirSync(out, { recursive: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.25 });
    const page = await context.newPage(); const logs = [], errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.text().includes('gl adapter')) logs.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    const epoch = new Date('2026-10-07T00:00:00Z'); await page.clock.install({ time: epoch }); await page.clock.pauseAt(epoch); await page.goto(url);
    for (let i = 0; i < 40 && !await page.evaluate(() => window.__skyriver?.stats().firstFrameMs !== null && !!window.__skyriver); i++) await page.clock.runFor(100);
    await page.waitForFunction(() => window.__skyriver?.stats().firstFrameMs != null, null, { timeout: 60000 });
    await page.evaluate(() => window.__skyriver.scene.resize(1280, 720));
    return { browser, page, logs, errors };
  } catch (error) { await browser.close(); throw error; }
}
async function freezeAtRoute(page, targetM) {
  await page.evaluate(() => window.__skyriver.resume());
  let v = await page.evaluate(() => window.__skyriver.scene.routePosition());
  if (v > targetM + 1) throw Error('Start a new page to move backward.');
  for (let i = 0; i < 2000 && v < targetM; i++) { await page.clock.runFor(Math.min(100, Math.max(1, (targetM - v) / 2))); v = await page.evaluate(() => window.__skyriver.scene.routePosition()); }
  if (!Number.isFinite(v) || v < targetM) { await page.evaluate(() => window.__skyriver.suspend()); throw Error('Route did not reach target ' + targetM + ' m; actual ' + v + ' m.'); }
  return page.evaluate(() => { const a = window.__skyriver; a.suspend(); const c = a.scene.camera, s = a.renderState(); return { routeM: a.scene.routePosition(), tick: s.current.tick, alpha: s.alpha, clockMs: performance.now(), position: c.position.toArray(), quaternion: c.quaternion.toArray(), up: c.up.toArray(), fov: c.fov, aspect: c.aspect }; });
}
async function settle(page, frames = 24) { for (let i = 0; i < frames; i++) { await page.clock.runFor(16); await page.evaluate(() => { const a = window.__skyriver, s = a.renderState(); a.scene.update(s.current.tick, s.current, s.alpha); }); } }
const quantile = (x, p) => { const a = [...x].sort((a, b) => a - b); if (!a.length) return null; return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))]; };
module.exports = { write, sha, args, gpuLock, open, freezeAtRoute, settle, quantile };
