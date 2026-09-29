// Live check: every click shows a result. Saves one frame per case.
// Needs the dev server on AUDIT_URL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const out = process.env.CLICK_OUT ?? '/tmp/wreck-visual/click-feedback';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?record&quality=high`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 90000 });
  const local = () => page.evaluate(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return { frame: r.frame, ...r.players.find((p) => p.slot === r.localSlot) }; });
  const lookAt = (target) => page.evaluate((t) => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const me = r.players.find((p) => p.slot === r.localSlot);
    const eye = [me.position[0], me.position[1] + 1.55, me.position[2]];
    const d = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]];
    window.__SET_LOOK_ANGLES__(Math.atan2(-d[0], -d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2])));
  }, target);
  const shot = async (name) => {
    const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
    await fs.writeFile(`${out}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  };
  const click = async (name, tool, target, { hold = 90, release = true } = {}) => {
    await page.evaluate((t) => window.__SIMULATE_INPUT__({ tool: t }), tool);
    await lookAt(target);
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: true }));
    await page.waitForTimeout(hold);
    const player = await local();
    await shot(name);
    if (release) await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
    await page.waitForTimeout(400);
    results[name] = { result: player.feedback?.result ?? null, ageTicks: player.feedback ? player.frame - player.feedback.frame : null };
    return player;
  };

  const me = await local();
  // 1. Open sky: nothing in range.
  await click('gun-miss', 'hand', [me.position[0], me.position[1] + 60, me.position[2] - 20]);
  // 2. The south wall behind the spawn point.
  await click('gun-blocked-wall', 'hand', [me.position[0], me.position[1] + 0.5, 30]);
  // 3. The nearest movable body.
  const target = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const me = r.players.find((p) => p.slot === r.localSlot);
    let best;
    for (const body of r.bodies) {
      const pose = r.poses.get(body.id);
      if (body.motion !== 'dynamic' || !pose || body.id === 'vehicle-chassis') continue;
      const d = Math.hypot(pose.position[0] - me.position[0], pose.position[2] - me.position[2]);
      if (d > 2.8 && d < 9 && (!best || d < best.d)) best = { d, p: pose.position };
    }
    return best.p;
  });
  await click('gun-grab', 'hand', target);
  // 4. Hold with the tractor beam while swinging the aim: the lagging body bends the beam.
  await lookAt(target);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ tool: 'hand', pressed: true }));
  await page.waitForTimeout(700);
  const aimNow = await local();
  await page.evaluate(([yaw, pitch]) => window.__SET_LOOK_ANGLES__(yaw + 0.45, pitch + 0.1), [aimNow.yaw, aimNow.pitch]);
  await page.waitForTimeout(90);
  const holding = await local();
  await shot('gun-hold-bend');
  results['gun-hold-bend'] = { holding: holding.grabbing };
  // 5. Release: the throw shows an energy burst, not a beam.
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
  await page.waitForTimeout(70);
  const thrown = await local();
  await shot('gun-throw-burst');
  results['gun-throw-burst'] = { result: thrown.feedback?.result ?? null, ageTicks: thrown.frame - (thrown.feedback?.frame ?? 0) };
  // 6. Punt the nearest body.
  await page.waitForTimeout(900);
  const puntTarget = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const me = r.players.find((p) => p.slot === r.localSlot);
    let best;
    for (const body of r.bodies) {
      const pose = r.poses.get(body.id);
      if (body.motion !== 'dynamic' || !pose || body.id === 'vehicle-chassis') continue;
      const d = Math.hypot(pose.position[0] - me.position[0], pose.position[2] - me.position[2]);
      if (d > 2.5 && d < 8 && (!best || d < best.d)) best = { d, p: pose.position };
    }
    return best.p;
  });
  await lookAt(puntTarget);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: true }));
  await page.waitForTimeout(70);
  const punted = await local();
  await shot('gun-punt-burst');
  await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: false }));
  results['gun-punt-burst'] = { result: punted.feedback?.result ?? null };
  // 7. Torch at the wall: flame and sparks, no cut.
  // The wall is far past TORCH_RANGE: the flame fires, but nothing is hit (src/sim/toolFeedback.test.ts covers scorch in reach).
  await click('torch-out-of-range', 'torch', [me.position[0], me.position[1] + 0.5, 30], { hold: 500 });

  assert.equal(results['gun-miss'].result, 'miss');
  assert.equal(results['gun-blocked-wall'].result, 'blocked');
  assert.equal(results['gun-grab'].result, 'grab');
  assert.equal(results['torch-out-of-range'].result, 'miss');
  assert.ok(results['gun-hold-bend'].holding, 'the tractor beam case was not holding a body');
  assert.equal(results['gun-throw-burst'].result, 'throw');
  assert.equal(results['gun-punt-burst'].result, 'punt');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
}
