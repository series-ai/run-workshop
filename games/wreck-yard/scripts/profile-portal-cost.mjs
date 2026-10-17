// Isolate portal style submission. Skipped passes are a timing diagnostic only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadavg, cpus } from 'node:os';
import { chromium } from 'playwright';

const label = process.argv[2] ?? 'portal-cost';
assert.match(label, /^[a-z0-9-]+$/);
const width = Number(process.env.PORTAL_WIDTH ?? 1440);
const height = Number(process.env.PORTAL_HEIGHT ?? 900);
assert.ok(Number.isInteger(width) && width >= 390 && width <= 3840);
assert.ok(Number.isInteger(height) && height >= 390 && height <= 2160);
const out = `test-results/monkey-perf/${label}`;
await mkdir(out, { recursive: true });
const result = { label, started: new Date().toISOString(), environment: { cpu: cpus()[0]?.model, load: loadavg(), width, height },
  diagnostic: 'A paused camera isolates rendering. Skipping the two portal style passes does not preserve appearance. It is not a product mode or a physics benchmark.', captures: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(`${process.env.AUDIT_URL ?? 'http://127.0.0.1:4490'}/?quality=high&capture=off`);
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 360, null, { timeout: 120000 });
  await page.evaluate(() => {
    window.__WRECK_YARD_CONTROLLER__.setPaused(true);
    window.__SET_CAMERA_OVERRIDE__([-2, 2.1, 14.5], [-2, 1.34, 20.3]);
    const { gl } = window.__DEBUG_THREE__;
    const render = gl.render;
    const audit = { skip: false, skipped: 0, styleDraws: 0 };
    window.__PORTAL_COST_AUDIT__ = audit;
    gl.render = function (scene, camera) {
      const name = scene.children?.[0]?.material?.name;
      if (name === 'yard-portal-depth-style' || name === 'yard-portal-style-copy') {
        audit.styleDraws += 1;
        if (audit.skip) { audit.skipped += 1; return; }
      }
      return render.call(this, scene, camera);
    };
  });
  for (const skip of [false, true, false, true]) {
    await page.evaluate(skip => { window.__PORTAL_COST_AUDIT__.skip = skip; }, skip);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const audit = window.__PORTAL_COST_AUDIT__;
      audit.skipped = 0;
      audit.styleDraws = 0;
      window.__WRECK_YARD_PERF__.start({ maxDurationMs: 10000, capacity: 65536 });
    });
    await page.waitForTimeout(4000);
    const capture = await page.evaluate(() => {
      const perf = window.__WRECK_YARD_PERF__.stop();
      const { gl, camera } = window.__DEBUG_THREE__;
      const ctx = gl.getContext(), ext = ctx.getExtension('WEBGL_debug_renderer_info');
      return { perf, audit: { ...window.__PORTAL_COST_AUDIT__ },
        hardware: { renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null, dpr: gl.getPixelRatio(), width: ctx.drawingBufferWidth, height: ctx.drawingBufferHeight },
        camera: camera.matrixWorld.toArray(), frame: window.__WRECK_YARD_CONTROLLER__.getRender().frame };
    });
    result.captures.push(capture);
    assert.ok(capture.audit.styleDraws > 0, 'The camera did not render a portal style pass.');
    assert.equal(capture.audit.skipped > 0, skip);
    assert.equal(capture.perf.overwrittenRecords, 0);
    if (!skip && result.captures.length === 1) await page.screenshot({ path: `${out}/normal.png` });
  }
  assert.deepEqual(result.errors, []);
} catch (error) {
  result.failure = String(error);
  process.exitCode = 1;
} finally {
  result.finished = new Date().toISOString();
  result.environment.loadEnd = loadavg();
  await browser.close();
  await writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.captures.map(c => ({ skip: c.audit.skip, frame: c.frame, interval: c.perf.counterSummary['frame.intervalMs'],
    portalCpu: c.perf.phaseSummary['portal.render'], portalGpu: c.perf.gpuPhaseSummary['portal.render'], gpuStatus: c.perf.gpu.status,
    skipped: c.audit.skipped, hardware: c.hardware })), null, 2));
  if (result.failure) console.error(result.failure);
}
