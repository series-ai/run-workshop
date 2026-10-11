// Live check for torch heat: walk to a prop, torch it, and save frames while the
// scorch glows red, turns brown, and goes burnt black. Then the hot voxels
// (SCORCH_MATERIAL 5) must be burnt (BURNT_MATERIAL 28).
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4400 --strictPort
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const out = process.env.HEAT_SHOTS ?? fileURLToPath(new URL('../test-results/heat/', import.meta.url));
const EYE_OFFSET = 1.55;
const SCORCH = 5;
const BURNT = 28;
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=high&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 90000 });
  const player = () => page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    return r.players.find((p) => p.slot === r.localSlot).position;
  });
  // The target and its fragments (fracture.ts names them <id>-p<serial>).
  const bodyInfo = (targetId) => page.evaluate(([id, scorch, burnt]) => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const pieces = r.bodies.filter((b) => b.id === id || b.id.startsWith(`${id}-p`));
    const count = (voxels, code) => voxels.reduce((n, v) => n + (v === code ? 1 : 0), 0);
    return {
      frame: r.frame,
      pieces: pieces.map((b) => ({ id: b.id, position: r.poses.get(b.id)?.position, heat: b.heat, scorch: count(b.voxels, scorch), burnt: count(b.voxels, burnt) })),
    };
  }, [targetId, SCORCH, BURNT]);
  const walkTo = async ([x, z], within) => {
    let last = null;
    let stalled = 0;
    for (let step = 0; step < 300 && stalled < 12; step += 1) {
      const p = await player();
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

  // Use a loose prop large enough to keep a heated surface after one cut.
  const target = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const me = r.players.find((p) => p.slot === r.localSlot).position;
    let best = null;
    for (const body of r.bodies) {
      const pose = r.poses.get(body.id);
      if (!pose || body.motion !== 'dynamic' || body.id === 'vehicle-chassis' || body.id.includes('drum')) continue;
      if (body.voxels.reduce((count, cell) => count + (cell === 0 ? 0 : 1), 0) < 1000) continue;
      const d = Math.hypot(pose.position[0] - me[0], pose.position[2] - me[2]);
      if (!best || d < best.d) best = { d, id: body.id, position: pose.position };
    }
    return best;
  });
  results.target = target.id;
  await walkTo([target.position[0], target.position[2] + 1.6], 0.35);
  await page.keyboard.press('Digit2');
  // Aim at the target, `sweep` meters along x from its center: a stroke keeps the torch cutting.
  const aim = async (sweep = 0) => {
    const p = await player();
    const c = (await bodyInfo(target.id)).pieces[0].position;
    const d = [c[0] + sweep, c[1] + 0.15, c[2]];
    const dx = d[0] - p[0];
    const dz = d[2] - p[2];
    const pitch = Math.atan2(d[1] - (p[1] + EYE_OFFSET), Math.hypot(dx, dz));
    await page.evaluate(([yaw, look]) => window.__SET_LOOK_ANGLES__(yaw, look), [Math.atan2(-dx, -dz), pitch]);
  };
  await aim();
  const canvas = await page.locator('canvas').first().boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  let heatedPieces = [];
  for (let i = 0; i < 8; i += 1) {
    await aim(-0.3 + i * 0.04);
    const frame = (await bodyInfo(target.id)).frame;
    await page.waitForFunction((until) => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= until, frame + 3, { timeout: 5000 });
    heatedPieces = (await bodyInfo(target.id)).pieces.filter((piece) => piece.heat && piece.scorch > 0);
    if (heatedPieces.length > 0) break;
  }
  assert.ok(heatedPieces.length > 0, `the torch did not leave a heated surface on ${target.id}`);
  // Watch from the side while the torch is still on: the camera moves, the aim does not.
  const me = await player();
  const focus = heatedPieces[0].position;
  const away = [me[0] - focus[0], me[2] - focus[2]];
  const length = Math.hypot(...away) || 1;
  const side = [-away[1] / length, away[0] / length];
  const camera = [focus[0] + (away[0] / length) * 1.2 + side[0] * 1.0, focus[1] + 1.0, focus[2] + (away[1] / length) * 1.2 + side[1] * 1.0];
  await page.evaluate(([p, l]) => window.__SET_CAMERA_OVERRIDE__(p, l), [camera, focus]);
  await page.locator('canvas').first().screenshot({ path: `${out}/0-torch-on.png` });
  results.torchOn = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const p = r.players.find((entry) => entry.slot === r.localSlot);
    return { frame: r.frame, feedback: p.feedback?.result, heats: r.bodies.filter((b) => b.heat).map((b) => ({ id: b.id, age: (r.frame - b.heat.frame) / 30, at: b.heat.at, dims: b.dims })) };
  });
  await page.mouse.up();
  await page.keyboard.press('Digit3');

  const hot = await bodyInfo(target.id);
  results.afterTorch = hot;
  const heated = hot.pieces.filter((piece) => piece.heat && piece.scorch > 0);
  assert.ok(heated.length > 0, `the torch did not heat ${target.id}: ${JSON.stringify(hot)}`);
  const lastHeat = Math.max(...heated.map((piece) => piece.heat.frame));

  // Frames at heat ages of about 0.3, 1, 2.5, 4.5, and 7 s, timed by the sim frame (30 Hz).
  results.shots = {};
  for (const [name, seconds] of [['1-glow', 0.3], ['2-dull', 1], ['3-brown', 2.5], ['4-dark', 4.5], ['5-burnt', 7]]) {
    await page.waitForFunction(([frame]) => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= frame, [lastHeat + Math.round(seconds * 30)], { timeout: 20000 });
    await page.locator('canvas').first().screenshot({ path: `${out}/${name}.png` });
    results.shots[name] = ((await bodyInfo(target.id)).frame - lastHeat) / 30;
  }
  const cold = await bodyInfo(target.id);
  results.afterCooling = cold;
  assert.ok(cold.pieces.every((piece) => piece.scorch === 0 && piece.heat === null), `the scorch did not cool: ${JSON.stringify(cold)}`);
  assert.ok(cold.pieces.some((piece) => piece.burnt > 0), `no burnt voxels: ${JSON.stringify(cold)}`);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(results, null, 1));
} finally {
  await browser.close();
}
