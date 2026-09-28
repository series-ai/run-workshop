// Live check: holding a body with the gravity gun must not cost more frame time
// than idle. Runs with the CPU slowed 4x so a fast desktop shows dropped frames.
// Needs the dev server on AUDIT_URL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let result;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(1500);

  const sample = () => page.evaluate(() => new Promise((resolve) => {
    const times = [];
    let previous;
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const firstTick = controller.getRender().frame;
    const start = performance.now();
    const frame = (now) => {
      if (previous !== undefined) times.push(now - previous);
      previous = now;
      if (times.length < 150) requestAnimationFrame(frame);
      else {
        const sorted = [...times].sort((a, b) => a - b);
        const seconds = (performance.now() - start) / 1000;
        resolve({
          meanFrameMs: times.reduce((a, b) => a + b, 0) / times.length,
          p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
          ticksPerSecond: (controller.getRender().frame - firstTick) / seconds,
        });
      }
    };
    requestAnimationFrame(frame);
  }));

  const idle = await sample();
  // Aim at the nearest dynamic body and hold the gravity gun.
  const grabbed = await page.evaluate(async () => {
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const render = controller.getRender();
    const me = render.players.find((p) => p.slot === render.localSlot);
    const eye = [me.position[0], me.position[1] + 1.55, me.position[2]];
    let best;
    for (const body of render.bodies) {
      const pose = render.poses.get(body.id);
      if (body.motion !== 'dynamic' || !pose || body.id === 'vehicle-chassis') continue;
      const d = Math.hypot(pose.position[0] - eye[0], pose.position[2] - eye[2]);
      if (d > 2.8 && d < 9 && (!best || d < best.d)) best = { id: body.id, d, p: pose.position };
    }
    const dx = best.p[0] - eye[0], dy = best.p[1] - eye[1], dz = best.p[2] - eye[2];
    window.__SET_LOOK_ANGLES__(Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
    await new Promise((r) => setTimeout(r, 300));
    window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true });
    await new Promise((r) => setTimeout(r, 600));
    const now = controller.getRender();
    return { target: best.id, holding: now.players.find((p) => p.slot === now.localSlot).grabbing };
  });
  assert.ok(grabbed.holding, `gravity gun did not grab ${grabbed.target}`);
  const holding = await sample();
  await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
  result = { grabbed, idle, holding, errors };
  // Holding may cost a little more, never a large fraction of a frame.
  assert.ok(holding.meanFrameMs < idle.meanFrameMs * 1.25 + 2, 'frame time rises sharply while holding');
  assert.ok(holding.ticksPerSecond > 27, `simulation falls behind while holding (${holding.ticksPerSecond.toFixed(1)} ticks/s)`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  console.log(JSON.stringify(result, null, 1));
}
