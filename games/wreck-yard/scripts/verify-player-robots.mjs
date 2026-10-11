// Run the game avatar component in a browser with all four player slots.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('.');
const out = resolve('test-results/player-robots');
await mkdir(out, { recursive: true });
const server = await createServer({ configFile: false, root, plugins: [react()], esbuild: { target: 'es2022' }, optimizeDeps: { esbuildOptions: { target: 'es2022' } }, server: { host: '127.0.0.1', port: 4428, strictPort: true, hmr: false, fs: { allow: [root, resolve('../../tools/voxel-kit')] } } });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4428/e2e/player-robots.html');
    await page.waitForFunction(() => !!window.__ROBOTS__, null, { timeout: 60000 });
    let standing = null;
    for (const scenario of ['stand', 'move', 'torch', 'aim', 'jet', 'first-person', 'driver-0', 'driver-1', 'driver-2', 'driver-3', 'stand']) {
      await page.evaluate(scenario => window.__ROBOTS__.scenario(scenario), scenario);
      const state = await page.evaluate(() => window.__ROBOTS__.inspect());
      assert.deepEqual(state.players.map(p => p.robot), ['scrapper', 'drum', 'tread', 'hover']);
      for (const player of state.players) {
        assert.equal(player.visible, scenario !== 'first-person' || player.slot !== 0);
        const driving = scenario === `driver-${player.slot}`;
        assert.equal(player.toolVisible, !driving);
        if (driving) assert.ok(player.eyeHeightAboveChassis > 0.31 && player.eyeHeightAboveChassis < 0.6, `Driver P${player.slot + 1} eye height ${player.eyeHeightAboveChassis}`);
        assert.equal(player.seatScale[0], driving ? 0.6 : 1);
        assert.ok(player.flames.every(on => on === (scenario === 'jet')));
        if (!driving) assert.ok(player.aimGapRadians < 0.001, `P${player.slot + 1} aim gap ${player.aimGapRadians}`);
        assert.equal(player.toolColor, scenario === 'torch' || scenario === 'aim' ? 'ff8a3c' : '5fe0ff');
        if (!driving) assert.ok(player.muzzleGap < 0.12, `P${player.slot + 1} tool muzzle gap ${player.muzzleGap}`);
      }
      if (scenario === 'move') {
        assert.ok(Math.abs(state.players[0].wheelAngle - standing.players[0].wheelAngle - 0.6) < 1e-6);
        assert.ok(Math.abs(state.players[2].trackPhase - standing.players[2].trackPhase) > 0.01);
      }
      if (scenario === 'stand') standing = state;
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${scenario}-${width}.png` });
      const profile = scenario === 'stand' && width === 1440 ? await page.evaluate(() => window.__ROBOTS__.profile()) : null;
      results.push({ width, scenario, state, profile });
    }
    await page.close();
  }
  await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length} robot scenarios, all four slots, desktop and phone widths.`);
} finally {
  await browser.close();
  await server.close();
}
