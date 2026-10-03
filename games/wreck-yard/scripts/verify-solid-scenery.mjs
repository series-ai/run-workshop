// Live check: the player walks straight at large set pieces and must be stopped
// at their surface, not pass through. Needs the dev server on AUDIT_URL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
/**
 * Smoke check in the live game. src/sim/solidScenery.test.ts walks the player
 * into every ground-level set piece headlessly; this proves the same in the browser.
 * Targets: world XZ center, footprint half size before yaw, and a clear route of waypoints.
 */
const TARGETS = [
  { name: 'gantry base (rail bogie under the A-frame legs)', center: [-13.5, -1.5], half: [0.7, 2.7], yaw: 0, route: [[-9, -1.0]] },
  // Containers, wrecks, and blocks are dynamic props now (sim/props.ts): the player pushes them.
  { name: 'demolition rig carriage', center: [-5, -17], half: [1.8, 1.6], yaw: 0, route: [[7.5, 9], [7.5, -12.5], [-2, -12.5], [-2, -17]] },
];
const PLAYER_RADIUS = 0.4;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const player = () => page.evaluate(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find((p) => p.slot === r.localSlot).position; });
  // Depth of the player center inside the target footprint grown by the capsule radius (<= 0 is outside).
  const penetration = (p, t) => {
    const dx = p[0] - t.center[0];
    const dz = p[2] - t.center[1];
    // three.js yaw: local = R(-yaw) * world.
    const lx = dx * Math.cos(t.yaw) - dz * Math.sin(t.yaw);
    const lz = dx * Math.sin(t.yaw) + dz * Math.cos(t.yaw);
    return Math.min(t.half[0] + PLAYER_RADIUS - Math.abs(lx), t.half[1] + PLAYER_RADIUS - Math.abs(lz));
  };
  const walkTo = async (goal, stopWithin) => {
    let last = await player();
    let stalled = 0;
    for (let step = 0; step < 400 && stalled < 12; step += 1) {
      const p = await player();
      const dx = goal[0] - p[0];
      const dz = goal[1] - p[2];
      if (Math.hypot(dx, dz) < stopWithin) break;
      await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(100);
      const now = await player();
      stalled = Math.hypot(now[0] - last[0], now[2] - last[2]) < 0.03 ? stalled + 1 : 0;
      last = now;
    }
    await page.keyboard.up('KeyW');
  };
  for (const target of TARGETS) {
    for (const waypoint of target.route) await walkTo(waypoint, 0.6);
    const start = await player();
    let deepest = -Infinity;
    let last = await player();
    let stalled = 0;
    for (let step = 0; step < 400 && stalled < 12; step += 1) {
      const p = await player();
      const dx = target.center[0] - p[0];
      const dz = target.center[1] - p[2];
      await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(100);
      const now = await player();
      deepest = Math.max(deepest, penetration(now, target));
      stalled = Math.hypot(now[0] - last[0], now[2] - last[2]) < 0.03 ? stalled + 1 : 0;
      last = now;
    }
    await page.keyboard.up('KeyW');
    const final = await player();
    const distance = Math.hypot(final[0] - target.center[0], final[2] - target.center[1]);
    results.push({
      target: target.name,
      reachedApproach: +Math.hypot(start[0] - target.route.at(-1)[0], start[2] - target.route.at(-1)[1]).toFixed(2),
      stalled: stalled >= 12,
      deepestPenetration: +deepest.toFixed(3),
      finalPenetration: +penetration(final, target).toFixed(3),
      finalDistance: +distance.toFixed(2),
    });
  }
  // A 0.12 m allowance covers the KCC skin and one tick of motion.
  for (const result of results) {
    assert.ok(result.stalled, `${result.target}: the player never stopped`);
    assert.ok(result.reachedApproach < 1.0, `${result.target}: the approach waypoint was blocked`);
    assert.ok(result.deepestPenetration < 0.12, `${result.target}: the player passed into it (${result.deepestPenetration} m)`);
    // The target itself stopped the player: it ends at the target surface.
    assert.ok(result.finalPenetration > -0.35, `${result.target}: something else stopped the player (${result.finalPenetration} m short)`);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  console.log(JSON.stringify(results, null, 1));
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
