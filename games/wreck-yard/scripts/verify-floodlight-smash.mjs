// Live check for the floodlight smash: walk to a slalom drum, grab it with the
// gravity gun, carry it under the south-east lamp, aim at the lens, and punt.
// It checks that the sim breaks the lens, and it captures the lamp before the
// hit, while the glass falls, and after. Needs the dev server on AUDIT_URL.
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
/** Eye above the player position (src/sim/constants.ts PLAYER_EYE_OFFSET). */
const EYE_OFFSET = 1.55;
/** The south-east mast and its lens (src/sim/setPieces.ts floodlightLensCenter). */
const MAST = [21.5, 21];
const LENS_ID = 'set-mast-lens-21.5-21';
const out = process.env.FLOODLIGHT_SHOTS ?? fileURLToPath(new URL('../test-results/floodlight/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  // FLOODLIGHT_VIEWPORT=390x844 runs the same check on a phone-size page.
  const [width, height] = (process.env.FLOODLIGHT_VIEWPORT ?? '1280x800').split('x').map(Number);
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const render = () => page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = r.players.find((p) => p.slot === r.localSlot);
    return {
      frame: r.frame, contraptions: r.contraptions, stats: r.stats, player: player.position, grabbing: player.grabbing ?? null,
      feedback: player.feedback?.result ?? null, drum: r.poses.get('slalom-drum-1')?.position ?? null,
    };
  });
  const shot = async (name, pos, lookAt) => {
    await page.evaluate(([p, l]) => window.__SET_CAMERA_OVERRIDE__(p, l), [pos, lookAt]);
    await page.waitForTimeout(60);
    await page.locator('canvas').first().screenshot({ path: `${out}/${name}.png` });
    await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__(null));
  };
  const look = async (target) => {
    const p = (await render()).player;
    const dx = target[0] - p[0];
    const dz = target[2] - p[2];
    const pitch = Math.atan2(target[1] - (p[1] + EYE_OFFSET), Math.hypot(dx, dz));
    await page.evaluate(([yaw, tilt]) => window.__SET_LOOK_ANGLES__(yaw, tilt), [Math.atan2(-dx, -dz), pitch]);
  };
  /** Walks with the look turned toward the target. `face` turns the view back to a point after each step. */
  const walkTo = async ([x, z], within = 0.5, face = null) => {
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
    if (face) await look(face);
  };

  const start = await render();
  // The player stands on the floor at spawn, so its height is FLOOR_Y. The lamp row is 11.2 m above it.
  const floorY = start.player[1];
  const yaw = Math.atan2(-MAST[0], -MAST[1]);
  const lens = [MAST[0] + Math.sin(yaw) * 0.43, floorY + 11.2, MAST[1] + Math.cos(yaw) * 0.43];
  const stand = [lens[0] + Math.sin(yaw) * 7, lens[2] + Math.cos(yaw) * 7];
  const lampView = [[lens[0] + Math.sin(yaw) * 6, floorY + 9.5, lens[2] + Math.cos(yaw) * 6], lens];

  assert.equal(start.stats.lampsSmashed, 0);
  await shot('lamp-before', ...lampView);

  // Walk east past the bowling lane, then to the slalom drum, and grab it.
  for (const waypoint of [[7.5, 9], [10, 15.6]]) await walkTo(waypoint);
  const drum = (await render()).drum;
  assert.ok(drum, 'the slalom drum is missing');
  await look(drum);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ tool: 'hand' }));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: true }));
  await page.waitForTimeout(400);
  results.grab = (await render()).grabbing;
  assert.equal(results.grab, 'slalom-drum-1', `the gravity gun did not grab the drum: ${JSON.stringify(await render())}`);

  // Carry the drum to the stand point, aim at the lens, let the hold settle, and punt.
  await walkTo(stand, 0.4);
  await look(lens);
  await page.waitForTimeout(900);
  await look(lens);
  results.beforePunt = await render();
  await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: true }));
  await page.waitForTimeout(120);
  await page.evaluate(() => window.__SIMULATE_INPUT__({ secondary: false, pressed: false }));
  await page.waitForFunction((id) => window.__WRECK_YARD_CONTROLLER__.getRender().contraptions.lamps.some((lamp) => lamp.lampId === id && lamp.brokenAt !== null), LENS_ID, { timeout: 4000 });
  await shot('lamp-breaking', ...lampView);
  // About 0.8 s after the hit, the glass is half way down and 1.5 to 4.5 m out toward the yard.
  await page.waitForTimeout(600);
  await shot('glass-falling', [lens[0] + Math.sin(yaw) * 11, floorY + 4, lens[2] + Math.cos(yaw) * 11], [lens[0] + Math.sin(yaw) * 2.5, floorY + 6, lens[2] + Math.cos(yaw) * 2.5]);
  await page.waitForTimeout(2500);
  await shot('lamp-after', ...lampView);
  const end = await render();
  results.smashedLamps = end.contraptions.lamps.filter((lamp) => lamp.brokenAt !== null).map((lamp) => lamp.lampId);
  results.lampsSmashed = end.stats.lampsSmashed;
  results.breaksHud = await page.evaluate(() => [...document.querySelectorAll('.yard-tally span')].map((span) => span.textContent));
  assert.deepEqual(results.smashedLamps, [LENS_ID]);
  assert.equal(results.lampsSmashed, 1);
  results.audio = await page.evaluate(() => window.__DEBUG_AUDIO__?.() ?? null);
  results.errors = errors;
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...results, beforePunt: { player: results.beforePunt.player, drum: results.beforePunt.drum, feedback: results.beforePunt.feedback } }, null, 2));
} finally {
  await browser.close();
}
