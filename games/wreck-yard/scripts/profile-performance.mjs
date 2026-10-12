// Real Chrome captures. CPU stages are inclusive. GPU queries do not wait.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadavg, cpus, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const label = process.argv[2] ?? 'capture';
assert.match(label, /^[a-z0-9-]+$/);
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const out = fileURLToPath(new URL(`../test-results/performance/${label}/`, import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
const result = { label, started: new Date().toISOString(), machine: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem(), load: loadavg() }, captures: [], errors: [] };
try {
  for (const mobile of (process.argv.includes('--cpu-profile') ? [false] : [false, true])) {
    const page = await browser.newPage({ viewport: mobile ? { width: 844, height: 390 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile,
      ...(mobile ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36' } : {}) });
    page.on('pageerror', error => result.errors.push(error.message));
    await page.goto(`${base}${process.env.PERF_PATH ?? '/'}?capture=off&record&quality=${mobile ? 'low' : 'high'}`);
    await page.waitForFunction(() => window.__WRECK_YARD_PERF__ && (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 90, null, { timeout: 120000 });
    const hardware = await page.evaluate(() => {
      const { gl } = window.__DEBUG_THREE__;
      const ctx = gl.getContext(), ext = ctx.getExtension('WEBGL_debug_renderer_info');
      return { renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable', dpr: gl.getPixelRatio(), width: ctx.drawingBufferWidth, height: ctx.drawingBufferHeight, shadows: gl.shadowMap.enabled, nativeMemoryBytes: window.__WRECK_WASM_MEMORY_BYTES__?.() ?? null };
    });
    for (const [view, position, target] of [
      ['storage', [-9.5, 11.6, -5], [-10.5, 4.5, -20.7]],
      ['portal', [-2, 2.1, 14.5], [-2, 1.34, 20.3]],
      ['moving', null, null],
    ]) {
      if (process.argv.includes('--cpu-profile') && view !== 'storage') continue;
      await page.evaluate(([position, target]) => window.__SET_CAMERA_OVERRIDE__(position, target), [position, target]);
      await page.waitForTimeout(700);
      const cdp = process.argv.includes('--cpu-profile') ? await page.context().newCDPSession(page) : null;
      if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
      await page.evaluate(() => window.__WRECK_YARD_PERF__.start({ maxDurationMs: 15000, capacity: 65536 }));
      if (view === 'moving') await page.keyboard.down('KeyW');
      await page.waitForTimeout(3500);
      if (view === 'moving') await page.keyboard.up('KeyW');
      await page.waitForTimeout(250);
      if (cdp) { const profile = await cdp.send('Profiler.stop'); await writeFile(`${out}/storage.cpuprofile`, JSON.stringify(profile.profile)); await cdp.detach(); }
      const capture = await page.evaluate(() => window.__WRECK_YARD_PERF__.stop());
      const name = `${mobile ? 'mobile-low' : 'desktop-high'}-${view}`;
      await writeFile(`${out}/${name}.json`, JSON.stringify(capture, null, 2));
      await page.screenshot({ path: `${out}/${name}.png` });
      result.captures.push({ name, hardware, phase: capture.phaseSummary, gpuPhase: capture.gpuPhaseSummary, counters: capture.counterSummary, heap: capture.jsHeap, gpu: { status: capture.gpu.status, reason: capture.gpu.reason, lost: capture.gpu.lostQueryCount }, overwrittenRecords: capture.overwrittenRecords, input: capture.inputLatencies });
      assert.equal(capture.overwrittenRecords, 0);
      assert.ok(capture.phaseSummary['frame.pump']?.count > 0);
      assert.ok(capture.counterSummary['webgl.calls']?.max > 1);
      assert.equal(await page.evaluate(() => window.__WRECK_YARD_PERF__.isActive()), false);
    }
    await page.close();
  }
  result.finished = new Date().toISOString();
  result.machine.loadEnd = loadavg();
  await writeFile(`${out}/summary.json`, JSON.stringify(result, null, 2));
  assert.deepEqual(result.errors, []);
  console.log(JSON.stringify(result.captures.map(c => ({ name: c.name, pump: c.phase['frame.pump']?.p50, native: c.phase['sim.nativeStep']?.p50, interpolation: c.phase['render.interpolate']?.p50, interval: c.counters['frame.intervalMs']?.p50, calls: c.counters['webgl.calls']?.p50, gpu: c.gpu, load: result.machine.load })), null, 2));
} finally { await browser.close(); }
