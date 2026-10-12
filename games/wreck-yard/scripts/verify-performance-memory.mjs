// Retained-memory check. Forced GC runs outside timed captures.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadavg } from 'node:os';
const restart = process.argv.includes('--restart');
const out = fileURLToPath(new URL(restart ? '../test-results/performance/memory-restart/' : '../test-results/performance/memory-soak/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-precise-memory-info'] });
const result = { kind: 'retained memory after explicit GC; not a frame-time benchmark', restart, load: loadavg(), snapshots: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(`${process.env.AUDIT_URL ?? 'http://127.0.0.1:4481'}/scripts/performance-profile.html?capture=off&record&quality=high`);
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 330, null, { timeout: 180000 });
  await page.evaluate(() => window.__SET_CAMERA_OVERRIDE__([-9.5, 11.6, -5], [-10.5, 4.5, -20.7]));
  const cdp = await page.context().newCDPSession(page);
  for (let sample = 0; sample < 4; sample++) {
    if (sample && restart) {
      await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.start({ kind: 'solo' }));
      await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 330, null, { timeout: 180000 });
    } else if (sample) await page.waitForTimeout(15000);
    await page.evaluate(() => window.__WRECK_YARD_PERF__.clear());
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    await page.evaluate(() => window.__WRECK_YARD_PERF__.start({ maxDurationMs: 5000, capacity: 32768 }));
    await page.waitForTimeout(2000);
    const snapshot = await page.evaluate(() => {
      const report = window.__WRECK_YARD_PERF__.stop();
      return { frame: window.__WRECK_YARD_CONTROLLER__.getRender().frame, nativeBytes: window.__WRECK_WASM_MEMORY_BYTES__(), counters: report.counterSummary, heap: report.jsHeap };
    });
    result.snapshots.push({ ...snapshot, retainedHeapAfterGC: heap });
  }
  await cdp.detach();
  const first = result.snapshots[0], last = result.snapshots.at(-1);
  result.retainedHeapDeltaBytes = last.retainedHeapAfterGC.usedSize - first.retainedHeapAfterGC.usedSize;
  result.loadEnd = loadavg();
  await writeFile(`${out}/summary.json`, JSON.stringify(result, null, 2));
  assert.deepEqual(result.errors, []);
  if (restart) assert.ok(result.snapshots.every(snapshot => snapshot.frame > 330), 'each new match must fill the rollback history');
  else assert.ok(last.frame - first.frame >= 900, 'soak must advance real simulation frames');
  for (const key of ['webgl.geometries', 'webgl.textures', 'webgl.programs', 'checkpoint.live']) {
    if (restart) {
      // The first match also uploads the starting view before the fixed view.
      assert.ok(last.counters[key].max <= first.counters[key].max, `${key} must not grow across new matches`);
      assert.ok(result.snapshots.slice(1).every(snapshot => snapshot.counters[key].max === last.counters[key].max), `${key} must reach a steady count after the first new match`);
    } else assert.equal(last.counters[key].max, first.counters[key].max, `${key} must reach a steady count`);
  }
  const nativeSamples = restart ? result.snapshots.slice(1) : result.snapshots;
  assert.ok(nativeSamples.every(snapshot => snapshot.nativeBytes === last.nativeBytes), 'native heap must reach a plateau');
  await writeFile(`${out}/summary.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
