// Inspect the live conveyor and save views from each side of the wall.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const output = new URL('../test-results/conveyor/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?quality=low&capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const geometry = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const { CONVEYOR, CONTRAPTION_COLLIDERS } = await import('/src/sim/contraptions.ts');
    const { ARENA_EXTENT } = await import('/src/sim/constants.ts');
    const group = window.__DEBUG_THREE__.scene.getObjectByName('SkyConveyor');
    const bounds = new THREE.Box3().setFromObject(group.children[0]);
    const collider = CONTRAPTION_COLLIDERS.find((body) => body.id === 'set-conveyor-belt');
    return { visible: [bounds.min.z, bounds.max.z], collision: [collider.center[2] - collider.size[2] / 2, collider.center[2] + collider.size[2] / 2], outside: -ARENA_EXTENT - CONVEYOR.zStart };
  });
  assert.ok(geometry.outside >= 20);
  assert.deepEqual(geometry.visible, geometry.collision);
  for (const [name, position, target] of [
    ['inside', [9, 3, -11], [0.2, 6, -37]],
    ['outside', [10, 11, -45], [0.2, 5, -25]],
  ]) {
    await page.evaluate(([p, t]) => window.__SET_CAMERA_OVERRIDE__(p, t), [position, target]);
    await page.waitForTimeout(250);
    await page.locator('canvas').first().screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)) });
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('results.json', output), JSON.stringify({ geometry, errors }, null, 2));
  console.log(JSON.stringify({ geometry, errors }));
} finally { await browser.close(); }
