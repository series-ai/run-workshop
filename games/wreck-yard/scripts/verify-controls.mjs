// Live check for key bindings and the buggy chase camera.
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4400 --strictPort
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const shot = process.env.CONTROLS_SHOT ?? fileURLToPath(new URL('../test-results/controls-chase.png', import.meta.url));
await fs.mkdir(new URL('.', `file://${shot}`), { recursive: true });
const TOOL = { hand: 0, torch: 1, none: 2 };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?record`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const input = () => page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.input);
  const frames = (n) => page.waitForTimeout(n * 34);
  const local = () => page.evaluate(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find((p) => p.slot === r.localSlot); });

  // Thruster: Space, Backspace (Mac "delete"), and Delete all fire it.
  for (const key of ['Space', 'Backspace', 'Delete']) {
    await page.keyboard.down(key);
    await frames(3);
    results[`thruster:${key}`] = (await input()).jetpack;
    await page.keyboard.up(key);
    await frames(3);
    assert.equal(results[`thruster:${key}`], true, `${key} did not fire the thruster`);
    assert.equal((await input()).jetpack, false, `${key} release left the thruster on`);
  }
  // Tools: 3 does nothing, O toggles orbit and returns to the last play tool.
  await page.keyboard.press('Digit2');
  await frames(2);
  assert.equal((await input()).tool, TOOL.torch);
  await page.keyboard.press('Digit3');
  await frames(2);
  results.digit3Tool = (await input()).tool;
  assert.equal(results.digit3Tool, TOOL.torch, '3 changed the tool');
  await page.keyboard.press('KeyO');
  await frames(2);
  results.orbitTool = (await input()).tool;
  assert.equal(results.orbitTool, TOOL.none, 'O did not enter orbit');
  await page.keyboard.press('KeyO');
  await frames(2);
  results.afterOrbitTool = (await input()).tool;
  assert.equal(results.afterOrbitTool, TOOL.torch, 'O did not return to the torch');
  results.orbitButton = await page.getByRole('button', { name: 'Orbit (O)' }).count();
  assert.equal(results.orbitButton, 1);
  await page.keyboard.press('Digit1');

  // Walk to the buggy, mount with E, and check the chase camera.
  for (let step = 0; step < 200; step += 1) {
    const [player, buggy] = await page.evaluate(() => {
      const r = window.__WRECK_YARD_CONTROLLER__.getRender();
      return [r.players.find((p) => p.slot === r.localSlot).position, r.poses.get('vehicle-chassis').position];
    });
    const dx = buggy[0] - player[0];
    const dz = buggy[2] - player[2];
    if (Math.hypot(dx, dz) < 1.8) break;
    await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
    await page.keyboard.down('KeyW');
    await frames(4);
    await page.keyboard.up('KeyW');
  }
  results.mountDistance = await page.evaluate(() => {
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const p = r.players.find((q) => q.slot === r.localSlot).position;
    const b = r.poses.get('vehicle-chassis').position;
    return Math.hypot(b[0] - p[0], b[2] - p[2]);
  });
  // Hold E across several sim ticks so the edge is sampled.
  await page.keyboard.down('KeyE');
  await frames(4);
  await page.keyboard.up('KeyE');
  await page.waitForFunction(() => { const r = window.__WRECK_YARD_CONTROLLER__.getRender(); return r.players.find((p) => p.slot === r.localSlot).ridingVehicle; }, null, { timeout: 5000 });
  // Right after mounting, the buggy faces a clear runway (+Z from the east lane).
  // Driving forward turns the view back to the heading, unless the player is looking around.
  const viewOffset = () => page.evaluate(() => {
    const c = window.__WRECK_YARD_CONTROLLER__;
    const [x, y, z, w] = c.getRender().poses.get('vehicle-chassis').rotation;
    const chassisYaw = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
    const gap = c.input.yaw / 1000 - chassisYaw;
    return { chassisYaw, offset: Math.abs(Math.atan2(Math.sin(gap), Math.cos(gap))) };
  });
  const lookSideways = async () => {
    const { chassisYaw } = await viewOffset();
    await page.evaluate((yaw) => window.__SET_LOOK_ANGLES__(yaw, 0.3), chassisYaw + 1.2);
  };
  await lookSideways();
  await frames(45);
  results.offsetStandingStill = +(await viewOffset()).offset.toFixed(2);
  assert.ok(results.offsetStandingStill > 1.1, `the view turned while the buggy stood still: ${results.offsetStandingStill}`);
  await lookSideways();
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 5; i += 1) { await lookSideways(); await frames(4); }
  results.offsetWhileLooking = +(await viewOffset()).offset.toFixed(2);
  const drivenFrom = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().poses.get('vehicle-chassis').position);
  await frames(70);
  await page.keyboard.up('KeyW');
  const drivenTo = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().poses.get('vehicle-chassis').position);
  results.drivenMeters = +Math.hypot(drivenTo[0] - drivenFrom[0], drivenTo[2] - drivenFrom[2]).toFixed(1);
  results.offsetAfterDriving = +(await viewOffset()).offset.toFixed(2);
  assert.ok(results.offsetWhileLooking > 1.0, `the view fought the mouse look: ${results.offsetWhileLooking}`);
  assert.ok(results.offsetAfterDriving < 0.35, `the view did not turn back to the heading: ${results.offsetAfterDriving}`);
  await page.keyboard.down('KeyW');
  await frames(25);
  await page.keyboard.up('KeyW');
  await frames(20);
  const chase = await page.evaluate(() => {
    const { camera, scene } = window.__DEBUG_THREE__;
    const r = window.__WRECK_YARD_CONTROLLER__.getRender();
    const buggy = r.poses.get('vehicle-chassis').position;
    const local = r.players.find((p) => p.slot === r.localSlot);
    const forward = camera.getWorldDirection(camera.position.clone());
    const toBuggy = [buggy[0] - camera.position.x, buggy[1] - camera.position.y, buggy[2] - camera.position.z];
    const distance = Math.hypot(...toBuggy);
    const facing = (forward.x * toBuggy[0] + forward.y * toBuggy[1] + forward.z * toBuggy[2]) / distance;
    let avatarVisible = false;
    scene.traverse((object) => { if (object.isGroup && object.children.some((c) => c.geometry?.type === 'CapsuleGeometry') && object.visible) avatarVisible = true; });
    return { distance, facing, cameraAbove: camera.position.y - buggy[1], riding: local.ridingVehicle, avatarVisible };
  });
  results.chase = chase;
  const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  await fs.writeFile(shot, Buffer.from(png.split(',')[1], 'base64'));
  assert.ok(chase.distance > 4 && chase.distance < 9, `chase distance ${chase.distance}`);
  assert.ok(chase.facing > 0.9, `camera does not face the buggy: ${chase.facing}`);
  assert.ok(chase.cameraAbove > 0.8, `camera not above the buggy: ${chase.cameraAbove}`);
  assert.ok(chase.avatarVisible, 'driver avatar hidden in the chase camera');
  // Delete also dismounts, like Space.
  await page.keyboard.down('Backspace');
  await frames(4);
  await page.keyboard.up('Backspace');
  await frames(2);
  results.dismountedByDelete = !(await local()).ridingVehicle;
  assert.ok(results.dismountedByDelete, 'Delete did not dismount');
  assert.deepEqual(errors, []);
} catch (error) {
  console.log(JSON.stringify(results, null, 1));
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
