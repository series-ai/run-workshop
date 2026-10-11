// Check visible supports and walk over a concrete slab in the live game.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const output = new URL('../test-results/yard-steps/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { platforms: [], walk: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (error) => result.errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 60, null, { timeout: 60000 });
  result.platforms = await page.evaluate(async () => {
    const { SHELL_BOXES } = await import('/src/sim/shell.ts');
    const { scene } = window.__DEBUG_THREE__;
    scene.updateMatrixWorld(true);
    return SHELL_BOXES.filter((box) => box.id.startsWith('plinth-')).map((box) => {
      const mesh = scene.getObjectByName(box.id);
      if (!mesh) throw new Error(`Missing visible support: ${box.id}`);
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      const v = scene.position.clone();
      return { id: box.id, visible: mesh.visible, transparent: mesh.material.transparent, expectedCenter: box.center, expectedSize: box.size, center: bounds.getCenter(v).toArray(), size: bounds.getSize(v).toArray() };
    });
  });
  assert.equal(result.platforms.length, 2);
  for (const platform of result.platforms) {
    assert.equal(platform.visible, true);
    assert.equal(platform.transparent, false);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(platform.center[axis] - platform.expectedCenter[axis]) < 1e-5);
      assert.ok(Math.abs(platform.size[axis] - platform.expectedSize[axis]) < 1e-5);
    }
  }
  const local = () => page.evaluate(() => {
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    return render.players.find((player) => player.slot === render.localSlot).position;
  });
  const walkTo = async (goal) => {
    for (let tick = 0; tick < 200; tick += 1) {
      const position = await local();
      const dx = goal[0] - position[0];
      const dz = goal[1] - position[2];
      if (Math.hypot(dx, dz) < 0.18) break;
      await page.evaluate(([x, z]) => window.__SET_LOOK_ANGLES__(Math.atan2(-x, -z), 0), [dx, dz]);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(34);
      result.walk.push(await local());
    }
    await page.keyboard.up('KeyW');
    const position = await local();
    assert.ok(Math.hypot(goal[0] - position[0], goal[1] - position[2]) < 0.35, `Blocked on route to ${goal}: ${position}`);
  };
  await walkTo([0, 6]);
  await page.evaluate(() => window.__SET_LOOK_ANGLES__(0, -0.18));
  await page.screenshot({ path: fileURLToPath(new URL('visible-supports.png', output)) });
  await walkTo([0, 9.5]);
  await walkTo([-16.2, 9.5]);
  await walkTo([-16.2, 8]);
  const start = result.walk.length;
  await walkTo([-12, 8]);
  const crossing = result.walk.slice(start);
  result.highest = Math.max(...crossing.map((position) => position[1]));
  assert.ok(result.highest > -0.21, `Player did not step onto the slab: ${result.highest}`);
  assert.deepEqual(result.errors, []);
  await page.screenshot({ path: fileURLToPath(new URL('after-slab-crossing.png', output)) });
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(result, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ platforms: result.platforms.length, highest: result.highest, errors: result.errors }));
