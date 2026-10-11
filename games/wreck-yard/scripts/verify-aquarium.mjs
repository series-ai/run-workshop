// Check the aquarium frame in the live game at both display widths.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const output = new URL('../test-results/aquarium/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 60, null, { timeout: 60000 });
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
    }
    await page.keyboard.up('KeyW');
    const position = await local();
    assert.ok(Math.hypot(goal[0] - position[0], goal[1] - position[2]) < 0.35, `Blocked at ${position}`);
  };
  await walkTo([7.5, 6]);
  await walkTo([7.5, 3.8]);
  const inspection = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { TANK } = await import('/src/sim/constants.ts');
    const { SHELL_BOXES } = await import('/src/sim/shell.ts');
    const { scene } = window.__DEBUG_THREE__;
    scene.updateMatrixWorld(true);
    const floor = SHELL_BOXES.find((box) => box.id === 'tank-floor');
    const base = scene.getObjectByName('aquarium-base');
    const frame = scene.getObjectByName('aquarium-frame');
    const rim = scene.getObjectByName('aquarium-rim');
    const glass = scene.getObjectByName('aquarium-glass');
    if (![base, frame, rim, glass].every((mesh) => mesh?.isMesh && mesh.visible)) throw new Error('Aquarium mesh missing');
    const bounds = new THREE.Box3().setFromObject(base);
    const ray = new THREE.Raycaster(new THREE.Vector3(TANK.center[0], TANK.surfaceY + 1, TANK.center[2]), new THREE.Vector3(0, -1, 0));
    // Use the real frame geometry with the normal mesh raycast method.
    const opening = [frame, rim].flatMap((mesh) => {
      const probe = new THREE.Mesh(mesh.geometry, mesh.material);
      probe.matrixAutoUpdate = false;
      probe.matrixWorld.copy(mesh.matrixWorld);
      const hits = [];
      probe.raycast(ray, hits);
      return hits;
    });
    const render = window.__WRECK_YARD_CONTROLLER__.getRender();
    const player = render.players.find((entry) => entry.slot === render.localSlot);
    window.__SET_LOOK_ANGLES__(Math.atan2(-(TANK.center[0] - player.position[0]), -(TANK.center[2] - player.position[2])), -0.22);
    return { center: bounds.getCenter(new THREE.Vector3()).toArray(), size: bounds.getSize(new THREE.Vector3()).toArray(), expected: floor, opaque: !base.material.transparent && !frame.material.transparent, openingHits: opening.length, baseTop: bounds.max.y, bottomY: TANK.bottomY };
  });
  assert.equal(inspection.opaque, true);
  assert.equal(inspection.openingHits, 0);
  assert.ok(Math.abs(inspection.baseTop - inspection.bottomY) < 1e-5);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(Math.abs(inspection.center[axis] - inspection.expected.center[axis]) < 1e-5);
    assert.ok(Math.abs(inspection.size[axis] - inspection.expected.size[axis]) < 1e-5);
  }
  for (const quality of ['low', 'high']) {
    if (quality === 'high') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: /Graphics/i }).click();
      await page.waitForTimeout(500);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: fileURLToPath(new URL(`${quality}-${width}.png`, output)) });
      results.push({ width, quality, ...inspection });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ results, errors }, null, 2));
} finally {
  await browser.close();
}
console.log(JSON.stringify({ captures: results.length, openTop: results.every((entry) => entry.openingHits === 0) }));
