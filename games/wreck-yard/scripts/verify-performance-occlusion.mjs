// Compare the game filter with the installed voxel-kit algorithm in Chrome.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const output = new URL('../test-results/performance/occlusion.json', import.meta.url);
const result = { url: base, errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(`${base}/?record&capture=off&quality=low`);
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 5,
    null, { timeout: 90000 });
  result.proof = await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    const moduleUrl = suffix => {
      const url = resources.find(value => new URL(value).pathname.endsWith(suffix));
      if (!url) throw new Error(`Loaded module not found: ${suffix}`);
      return url;
    };
    const urls = {
      filter: moduleUrl('/src/render/OcclusionUpdater.tsx'),
      oracle: moduleUrl('/voxel-kit/src/worldOcclusion.ts'),
      constants: moduleUrl('/src/sim/constants.ts'),
      view: moduleUrl('/src/render/viewConstants.ts'),
      shell: moduleUrl('/src/sim/shell.ts'),
    };
    const [{ occlusionBodiesWithinVolume, PoseCache }, { fillWorldOcclusionVolume },
      { VOXEL_SIZE }, { WORLD_OCCLUSION_SPEC: spec }, { SHELL_BOXES, shellBoxBounds }] =
      await Promise.all(Object.values(urls).map(url => import(url)));
    const controller = window.__WRECK_YARD_CONTROLLER__;
    const paused = controller.isPaused();
    controller.setPaused(true);
    try {
      const render = controller.getRender();
      const bounds = SHELL_BOXES.map(shellBoxBounds);
      const size = spec.dims.x * spec.dims.y * spec.dims.z;
      const cases = [];
      const worldBodies = (bodies, poses) => bodies.flatMap(body => {
        const pose = poses.get(body.id);
        return pose ? [{ dims: body.dims, voxels: body.voxels,
          position: pose.position, rotation: pose.rotation }] : [];
      });
      const compare = (name, bodies, poses) => {
        const filtered = occlusionBodiesWithinVolume(bodies, poses, spec);
        const full = fillWorldOcclusionVolume(new Uint8Array(size).fill(17), spec,
          worldBodies(bodies, poses), bounds, VOXEL_SIZE);
        const actual = fillWorldOcclusionVolume(new Uint8Array(size).fill(39), spec,
          worldBodies(filtered, poses), bounds, VOXEL_SIZE);
        let mismatches = 0, occupied = 0;
        for (let i = 0; i < size; i++) {
          if (full[i] !== actual[i]) mismatches++;
          if (full[i]) occupied++;
        }
        cases.push({ name, bodyCount: bodies.length, filteredCount: filtered.length,
          bytesCompared: size, occupied, mismatches });
        if (mismatches) throw new Error(`${name}: ${mismatches} unequal bytes`);
        return filtered;
      };
      const initial = compare('current-poses', render.bodies, render.poses);
      const initialIds = new Set(initial.map(body => body.id));
      const distant = render.bodies.find(body => !initialIds.has(body.id)
        && render.poses.has(body.id) && body.voxels.some(value => value !== 0));
      if (!distant) throw new Error('No distant occupied body in the live scene');
      const pose = render.poses.get(distant.id);
      const center = spec.min.map((value, axis) => (value + spec.max[axis]) * 0.5);
      const radius = 0.5 * VOXEL_SIZE * Math.hypot(distant.dims.x, distant.dims.y, distant.dims.z);
      const at = (position, rotation = pose.rotation) => {
        const poses = new Map(render.poses);
        poses.set(distant.id, { ...pose, position, rotation });
        return poses;
      };
      for (let axis = 0; axis < 3; axis++) {
        for (const side of [-1, 1]) {
          for (const gap of [-0.000001, 0, 0.000001]) {
            const position = [...center];
            position[axis] = (side < 0 ? spec.min[axis] : spec.max[axis]) + side * (radius + gap);
            compare(`boundary-axis-${axis}-side-${side}-gap-${gap}`, render.bodies, at(position));
          }
        }
      }
      const inside = at(center, [0, 0, 0, 1]);
      const entered = compare('distant-body-moved-inside', render.bodies, inside);
      if (!entered.some(body => body.id === distant.id)) throw new Error('Entered body was excluded');
      compare('body-moved-out', render.bodies, render.poses);
      const rotated = at(center, [Math.sin(0.37), 0, 0, Math.cos(0.37)]);
      const rotatedBodies = compare('body-rotated', render.bodies, rotated);
      const cache = new PoseCache();
      cache.update(entered, inside);
      const cacheChecks = { rotation: cache.hasChanges(rotatedBodies, rotated) };
      const replaced = { ...distant, voxels: distant.voxels.slice() };
      const replacedBodies = render.bodies.map(body => body.id === distant.id ? replaced : body);
      const replacedFiltered = compare('voxel-array-replaced', replacedBodies, rotated);
      cache.update(rotatedBodies, rotated);
      cacheChecks.replacedArray = cache.hasChanges(replacedFiltered, rotated);
      const cut = { ...replaced, voxels: replaced.voxels.slice() };
      let removedVoxels = 0;
      for (let i = 0; i < cut.voxels.length; i++) {
        if (i % cut.dims.x < cut.dims.x / 2 && cut.voxels[i] !== 0) {
          cut.voxels[i] = 0;
          removedVoxels++;
        }
      }
      const cutBodies = render.bodies.map(body => body.id === distant.id ? cut : body);
      const cutFiltered = compare('voxel-array-cut', cutBodies, rotated);
      cache.update(replacedFiltered, rotated);
      cacheChecks.cutArray = cache.hasChanges(cutFiltered, rotated);
      cache.update(initial, render.poses);
      cacheChecks.entered = cache.hasChanges(entered, inside);
      cache.update(entered, inside);
      cacheChecks.exited = cache.hasChanges(initial, render.poses);
      const beforeCut = fillWorldOcclusionVolume(new Uint8Array(size), spec,
        worldBodies([replaced], rotated), [], VOXEL_SIZE);
      const afterCut = fillWorldOcclusionVolume(new Uint8Array(size), spec,
        worldBodies([cut], rotated), [], VOXEL_SIZE);
      let changedCutBytes = 0;
      for (let i = 0; i < size; i++) if (beforeCut[i] !== afterCut[i]) changedCutBytes++;
      return { urls, frame: render.frame, bodyCount: render.bodies.length,
        selectedBody: distant.id, cases, removedVoxels, changedCutBytes, cacheChecks };
    } finally { controller.setPaused(paused); }
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.proof.bodyCount >= 536, 'Expected the full yard scene');
  assert.equal(result.proof.cases.length, 24);
  assert.ok(result.proof.cases.every(value => value.mismatches === 0));
  assert.ok(result.proof.cases[0].filteredCount < result.proof.bodyCount);
  assert.ok(result.proof.removedVoxels > 0 && result.proof.changedCutBytes > 0);
  assert.ok(Object.values(result.proof.cacheChecks).every(Boolean));
  result.passed = true;
} catch (error) {
  result.failure = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}
