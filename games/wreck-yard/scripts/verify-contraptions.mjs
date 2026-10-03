// Live check for the yard contraptions: walk to the drum button, press E, and
// watch the sky conveyor drop a fuel drum; torch the drum until it is lit and
// capture the explosion; then fire the catapult and capture the arm mid-swing.
// The catapult dunk and the blast push are covered by src/sim tests.
// Needs the dev server on AUDIT_URL.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
/** Eye above the player position (src/sim/constants.ts PLAYER_EYE_OFFSET). */
const EYE_OFFSET = 1.55;
const out = process.env.CONTRAPTION_SHOTS ?? fileURLToPath(new URL('../test-results/contraptions/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const render = () => page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const drums = r.bodies.filter((b) => b.id.startsWith('fuel-drum-')).map((b) => ({ id: b.id, position: r.poses.get(b.id)?.position }));
    return { frame: r.frame, dunks: r.stats.dunks, explosions: r.stats.explosions, contraptions: r.contraptions, drums, player: r.players.find((p) => p.slot === r.localSlot).position };
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

  // Drum button: stand 1.2 m east of it, press E.
  for (const waypoint of [[7.5, 9], [7.5, -9], [4.4, -11]]) await walkTo(waypoint);
  results.atDrumButton = (await render()).player.map((v) => +v.toFixed(2));
  await page.waitForTimeout(400);
  results.drumPrompt = await prompt();
  assert.equal(results.drumPrompt, 'Drop Drum', 'the HUD does not offer the drum button');
  await tapE();
  await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__.getRender().bodies.some((b) => b.id.startsWith('fuel-drum-')), null, { timeout: 3000 });
  await page.waitForTimeout(1800);
  await shot('drum-on-belt', [7, 5.5, -9], [0.2, 5.2, -22]);
  results.drumOnBelt = (await render()).drums[0];
  assert.ok(results.drumOnBelt.position[1] > 5, `the drum is not on the belt: ${results.drumOnBelt.position}`);
  await page.waitForTimeout(5500);
  results.drumLanded = (await render()).drums[0];
  assert.ok(results.drumLanded.position[1] < 0.6 && results.drumLanded.position[2] > -15, `the drum did not land in the yard: ${results.drumLanded.position}`);
  await shot('drum-landed', [5, 2.5, -7], [0.2, 0, -14]);

  // Torch the drum until it is lit, then capture the blast from the side.
  const drum = results.drumLanded.position;
  // Around the button post, then up to the drum from the south.
  await walkTo([4.4, -9]);
  await walkTo([drum[0] + 0.3, drum[2] + 1.9], 0.4);
  await page.keyboard.press('Digit2');
  const aimAtDrum = async () => {
    const p = (await render()).player;
    const d = (await render()).drums[0].position;
    const dx = d[0] - p[0];
    const dz = d[2] - p[2];
    const pitch = Math.atan2(d[1] - (p[1] + EYE_OFFSET), Math.hypot(dx, dz));
    await page.evaluate(([yaw, look]) => window.__SET_LOOK_ANGLES__(yaw, look), [Math.atan2(-dx, -dz), pitch]);
  };
  await aimAtDrum();
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  for (let tick = 0; tick < 40; tick += 1) {
    const state = await render();
    if (state.contraptions.drums[0]?.detonateAt !== null) break;
    if (tick % 5 === 0) await aimAtDrum();
    await page.waitForTimeout(100);
  }
  const torchState = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const p = r.players.find((entry) => entry.slot === r.localSlot);
    return { tool: p.activeTool, feedback: p.feedback, yaw: p.yaw, pitch: p.pitch, position: p.position };
  });
  await page.mouse.up();
  results.torch = torchState;
  const lit = (await render()).contraptions.drums[0];
  assert.ok(lit && lit.detonateAt !== null, `the torch did not light the drum: ${JSON.stringify(lit)}`);
  await shot('drum-lit', [drum[0] + 4, drum[1] + 2.2, drum[2] + 4], drum);
  results.beforeBlast = (await render()).player.map((v) => +v.toFixed(2));
  await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__.getRender().contraptions.explosions.length > 0, null, { timeout: 4000 });
  const side = [drum[0] + 7, drum[1] + 3.5, drum[2] + 7];
  await page.evaluate(([p, l]) => window.__SET_CAMERA_OVERRIDE__(p, l), [side, drum]);
  for (const [name, wait] of [['blast-0', 40], ['blast-1', 120], ['blast-2', 250], ['blast-3', 600], ['blast-4', 1200]]) {
    await page.waitForTimeout(wait);
    await page.locator('canvas').first().screenshot({ path: `${out}/${name}.png` });
  }
  await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  const after = await render();
  results.afterBlast = { explosions: after.explosions, drums: after.drums.length, player: after.player.map((v) => +v.toFixed(2)) };
  assert.equal(after.explosions, 1, 'the drum did not explode');
  assert.equal(after.drums.length, 0, 'the drum is still in the yard');
  assert.ok(Math.hypot(after.player[0] - results.beforeBlast[0], after.player[2] - results.beforeBlast[2]) > 0.5, 'the blast did not move the player');

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
