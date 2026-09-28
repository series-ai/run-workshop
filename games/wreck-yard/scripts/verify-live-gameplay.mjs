import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const output = fileURLToPath(new URL('../public/showcase/audit/', import.meta.url));
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile-layout', { width: 390, height: 844 }, true]]) {
    const page = await browser.newPage({
      viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
      ...(mobile ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' } : {}),
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
    page.on('response', response => {
      if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 15, null, { timeout: 30000 });
    const waitTicks = async (ticks) => {
      const start = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().frame);
      await page.waitForFunction(start => window.__WRECK_YARD_CONTROLLER__.getRender().frame >= start, start + ticks, { timeout: 30000 });
    };
    const player = () => page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().players[0]);
    // A HUD click must not leave the primary tool held.
    await page.getByRole('button', { name: 'Plasma Torch (2)', exact: true }).click();
    await waitTicks(3);
    assert.equal(await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.input.pressed), false, 'HUD click fired the tool');
    await page.getByRole('button', { name: 'Gravity Gun (1)', exact: true }).click();
    const before = await player();
    await page.keyboard.down('KeyW');
    await waitTicks(12);
    await page.keyboard.up('KeyW');
    await waitTicks(6);
    const stopped = await player();
    await waitTicks(10);
    const rest = await player();
    const travel = Math.hypot(stopped.position[0] - before.position[0], stopped.position[2] - before.position[2]);
    const drift = Math.hypot(rest.position[0] - stopped.position[0], rest.position[2] - stopped.position[2]);
    assert.ok(travel > 0.2, `No forward travel: ${travel}`);
    assert.ok(drift < 0.08, `Player slides after release: ${drift}`);
    await page.keyboard.down('KeyW');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await waitTicks(3);
    assert.equal(await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.input.moveZ), 0, 'Focus loss kept movement pressed');
    await page.keyboard.up('KeyW');
    await page.evaluate(() => window.__SET_LOOK_ANGLES__(8, 0));
    await waitTicks(3);
    const sentYaw = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.input.yaw);
    assert.ok(Math.abs(sentYaw - Math.round(Math.atan2(Math.sin(8), Math.cos(8)) * 1000)) <= 1);
    await page.evaluate(() => window.__SET_LOOK_ANGLES__(0, 0));
    const profile = await page.evaluate(async () => {
      const { gl } = window.__DEBUG_THREE__;
      const controller = window.__WRECK_YARD_CONTROLLER__;
      const renderer = gl.getContext();
      const ext = renderer.getExtension('WEBGL_debug_renderer_info');
      const samples = [], calls = [];
      let previous;
      const firstFrame = controller.getRender().frame;
      const start = performance.now();
      // The ink composer renders several passes per frame; count them all.
      gl.info.autoReset = false;
      await new Promise(resolve => {
        function frame(now) {
          if (previous !== undefined) { samples.push(now - previous); calls.push(gl.info.render.calls); }
          gl.info.reset();
          previous = now;
          if (samples.length < 120) requestAnimationFrame(frame); else resolve();
        }
        requestAnimationFrame(frame);
      });
      gl.info.autoReset = true;
      const elapsed = performance.now() - start;
      const sorted = [...samples].sort((a, b) => a - b);
      return { samples: samples.length, meanFrameMs: samples.reduce((a,b) => a+b,0)/samples.length, p95FrameMs: sorted[Math.floor(sorted.length * .95)], maxFrameMs: sorted.at(-1), simulationTicks: controller.getRender().frame - firstFrame, elapsedMs: elapsed, meanDrawCalls: calls.reduce((a,b) => a+b,0)/calls.length, dpr: gl.getPixelRatio(), shadows: gl.shadowMap.enabled, renderer: ext ? renderer.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', note: 'Headless desktop browser. Mobile layout is not a phone benchmark.' };
    });
    assert.equal(profile.shadows, !mobile, 'Unexpected renderer quality path');
    if (!mobile) {
      const gpu = await page.evaluate(async () => {
        const { auditVoxelTraversal } = await import('/e2e/voxel-gpu-audit.ts');
        return auditVoxelTraversal(window.__DEBUG_THREE__.gl, window.__DEBUG_THREE__.scene);
      });
      assert.ok(gpu.every(result => result.differingPixels === 0 && result.coveredPixels > 0), 'GPU traversal differs from full traversal');
      await fs.writeFile(path.join(output, 'gpu-results.json'), JSON.stringify(gpu, null, 2));
    }
    await page.screenshot({ path: path.join(output, `live-${name}.png`) });
    assert.deepEqual(errors, [], 'Browser errors');
    results.push({ name, viewport, inputChecks: { travel, drift, sentYaw }, profile, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  await fs.writeFile(path.join(output, 'live-results.json'), JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));
} finally { await browser.close(); }
