// Live check for the yard contraptions: walk to the crate button, press E, and
// watch the sky conveyor drop a crate; then fire the catapult and capture the
// arm mid-swing. The catapult dunk itself is covered by src/sim/contraptions.test.ts.
// Needs the dev server on AUDIT_URL.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const out = process.env.CONTRAPTION_SHOTS ?? fileURLToPath(new URL('../test-results/contraptions/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const render = () => page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const crates = r.bodies.filter((b) => b.id.startsWith('supply-crate-')).map((b) => ({ id: b.id, position: r.poses.get(b.id)?.position }));
    return { frame: r.frame, dunks: r.stats.dunks, contraptions: r.contraptions, crates, player: r.players.find((p) => p.slot === r.localSlot).position };
  });
  const shot = async (name, pos, lookAt) => {
    await page.evaluate(([p, l]) => window.__SET_CAMERA_OVERRIDE__(p, l), [pos, lookAt]);
    await page.waitForTimeout(250);
    await page.locator('canvas').first().screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  };
  const walkTo = async ([x, z], within = 0.5) => {
    let last = null;
    let stalled = 0;
    for (let step = 0; step < 300 && stalled < 12; step += 1) {
      const p = (await render()).player;
      const dx = x - p[0];
      const dz = z - p[2];
      if (Math.hypot(dx, dz) < within) break;
      await page.evaluate(([a, b]) => window.__SET_LOOK_ANGLES__(Math.atan2(-a, -b), 0), [dx, dz]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(80);
      if (last) stalled = Math.hypot(p[0] - last[0], p[2] - last[2]) < 0.02 ? stalled + 1 : 0;
      last = p;
    }
    await page.keyboard.up('KeyW');
  };
  const tapE = async () => {
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(120);
    await page.keyboard.up('KeyE');
  };
  const prompt = () => page.evaluate(() => document.querySelector('[data-prompt]')?.getAttribute('data-prompt') ?? null);

  results.startDunks = (await render()).dunks;
  assert.equal(results.startDunks, 0);

  // Crate button: stand 1.2 m east of it, press E.
  for (const waypoint of [[7.5, 9], [7.5, -9], [4.4, -11]]) await walkTo(waypoint);
  results.atCrateButton = (await render()).player.map((v) => +v.toFixed(2));
  await page.waitForTimeout(400);
  results.cratePrompt = await prompt();
  assert.equal(results.cratePrompt, 'Drop Crate', 'the HUD does not offer the crate button');
  await tapE();
  await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__.getRender().bodies.some((b) => b.id.startsWith('supply-crate-')), null, { timeout: 3000 });
  await page.waitForTimeout(1800);
  await shot('crate-on-belt', [7, 5.5, -9], [0.2, 5.2, -22]);
  results.crateOnBelt = (await render()).crates[0];
  assert.ok(results.crateOnBelt.position[1] > 5, `the crate is not on the belt: ${results.crateOnBelt.position}`);
  await page.waitForTimeout(4500);
  results.crateLanded = (await render()).crates[0];
  assert.ok(results.crateLanded.position[1] < 0.6 && results.crateLanded.position[2] > -15, `the crate did not land in the yard: ${results.crateLanded.position}`);
  await shot('crate-landed', [5, 2.5, -7], [0.2, 0, -14]);

  // Catapult button: fire, and capture the arm near the top of its swing.
  for (const waypoint of [[7.5, -9], [7.5, 17], [12.4, 21.8]]) await walkTo(waypoint);
  results.catapultPrompt = await prompt();
  assert.equal(results.catapultPrompt, 'Fire Catapult', 'the HUD does not offer the catapult button');
  const before = (await render()).contraptions.lastLaunchFrame;
  await tapE();
  await page.waitForTimeout(260);
  await shot('catapult-swing', [3, 2.8, 17.5], [8.5, 1.2, 22]);
  results.launched = (await render()).contraptions.lastLaunchFrame > before;
  assert.ok(results.launched, 'the catapult did not fire');
  assert.deepEqual(errors, []);
} catch (error) {
  console.log(JSON.stringify(results, null, 1));
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
