// Measure the real camera after each scene render.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const label = process.env.CAMERA_RATE_LABEL ?? 'baseline';
assert.match(label, /^[a-z0-9-]+$/);
const output = new URL('../test-results/camera-rate/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { label, base, status: 'running', errors: [], inputCadenceNote: 'Input dispatch timing is set by this harness. It does not measure phone or mouse hardware.' };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summary(trace) {
  const samples = trace.frames;
  const intervals = [], eventIntervals = [];
  let sameTick = 0, sameTickLook = 0, sameTickWalk = 0, lookChanges = 0, walkChanges = 0;
  let rawPositionChanges = 0, interpolatedPositionChanges = 0;
  for (let index = 1; index < samples.length; index++) {
    const a = samples[index - 1], b = samples[index];
    intervals.push(b.ms - a.ms);
    const stable = a.frame === b.frame;
    const turned = Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch) > 1e-6;
    const moved = Math.hypot(...b.position.map((value, axis) => value - a.position[axis])) > 1e-6;
    if (stable) sameTick++;
    if (turned) { lookChanges++; if (stable) sameTickLook++; }
    if (moved) { walkChanges++; if (stable) sameTickWalk++; }
    if (Math.hypot(...b.rawPosition.map((value, axis) => value - a.rawPosition[axis])) > 1e-6) rawPositionChanges++;
    if (Math.hypot(...b.playerPosition.map((value, axis) => value - a.playerPosition[axis])) > 1e-6) interpolatedPositionChanges++;
  }
  for (let index = 1; index < trace.events.length; index++) eventIntervals.push(trace.events[index].ms - trace.events[index - 1].ms);
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? null;
  const duration = samples.length > 1 ? samples.at(-1).ms - samples[0].ms : 0;
  return {
    renders: samples.length, durationMs: duration, fps: duration ? (samples.length - 1) * 1000 / duration : 0,
    distinctTicks: new Set(samples.map((sample) => sample.frame)).size,
    sameTick, sameTickLook, sameTickWalk, lookChanges, walkChanges,
    rawPositionChanges, interpolatedPositionChanges,
    frameMs: { p50: percentile(intervals, 0.5), p95: percentile(intervals, 0.95), max: Math.max(0, ...intervals) },
    inputEvents: trace.events.length,
    inputEventMs: { p50: percentile(eventIntervals, 0.5), p95: percentile(eventIntervals, 0.95) },
    dprValues: [...new Set(samples.map((sample) => sample.dpr))],
    finalDpr: samples.at(-1)?.dpr ?? null,
    policyDprValues: [...new Set(samples.map((sample) => sample.perf?.dpr))],
    dprMismatchRenders: samples.filter((sample) => sample.perf && Math.abs(sample.dpr - sample.perf.dpr) > 0.001).length,
    dprTransitions: samples.filter((sample, index) => index === 0 || sample.dpr !== samples[index - 1].dpr).map((sample) => ({ ms: sample.ms - samples[0].ms, dpr: sample.dpr })),
  };
}

async function prepare(context) {
  const page = await context.newPage();
  page.on('pageerror', (error) => results.errors.push(error.message));
  await page.goto(`${base}/?capture=off`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35 && window.__DEBUG_THREE__?.gl, null, { timeout: 60000 });
  await page.evaluate(() => {
    const debug = window.__DEBUG_THREE__;
    const original = debug.gl.render;
    window.__CAMERA_RATE_TRACE__ = null;
    debug.gl.render = function (scene, camera) {
      const value = original.call(this, scene, camera);
      const trace = window.__CAMERA_RATE_TRACE__;
      if (trace && scene === debug.scene && camera === debug.camera) {
        const controller = window.__WRECK_YARD_CONTROLLER__;
        const render = controller.getRender();
        const player = render.players.find((entry) => entry.slot === render.localSlot);
        const forward = camera.getWorldDirection(camera.position.clone());
        trace.frames.push({
          ms: performance.now(), frame: render.frame,
          yaw: Math.atan2(-forward.x, -forward.z), pitch: Math.asin(forward.y),
          position: camera.position.toArray(), playerPosition: [...player.position],
          rawPosition: [...(player.soundPosition ?? player.position)],
          inputYaw: controller.input.yaw, simYaw: player.yaw,
          dpr: debug.gl.getPixelRatio(), perf: window.__PERF_METRICS__,
        });
      }
      const load = scene === debug.scene && camera === debug.camera ? window.__CAMERA_RATE_LOAD_MS__ ?? 0 : 0;
      const stop = performance.now() + load;
      while (performance.now() < stop) { /* Apply a fixed CPU load for this check. */ }
      return value;
    };
    for (const type of ['mousemove', 'pointermove']) document.addEventListener(type, (event) => {
      const trace = window.__CAMERA_RATE_TRACE__;
      if (trace) trace.events.push({ ms: performance.now(), type, pointerType: event.pointerType ?? 'mouse', dx: event.movementX, dy: event.movementY });
    }, true);
  });
  return page;
}

const begin = (page) => page.evaluate(() => { window.__CAMERA_RATE_TRACE__ = { frames: [], events: [] }; });
async function finish(page, name) {
  const trace = await page.evaluate(() => {
    const trace = window.__CAMERA_RATE_TRACE__;
    window.__CAMERA_RATE_TRACE__ = null;
    return trace;
  });
  results[name] = summary(trace);
  await writeFile(new URL(`${label}-${name}.json`, output), JSON.stringify(trace));
  return results[name];
}

try {
  if (process.env.CAMERA_RATE_MODE === 'budget') {
    results.loadKind = 'Fixed CPU load after rendering. This does not reproduce a weak GPU.';
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
    const page = await prepare(context);
    await page.waitForTimeout(2000);
    await begin(page);
    await page.waitForTimeout(2000);
    await finish(page, 'mobile-idle-budget');
    await page.evaluate(() => { window.__CAMERA_RATE_LOAD_MS__ = 18; });
    await begin(page);
    await page.waitForTimeout(2000);
    const actualDpr = () => page.evaluate(() => window.__DEBUG_THREE__.gl.getPixelRatio());
    results.loadToolChangeDpr = { before: await actualDpr() };
    await page.getByLabel('Equip torch', { exact: true }).tap();
    await page.waitForTimeout(1000);
    results.loadToolChangeDpr.afterTorch = await actualDpr();
    await page.getByLabel('Equip gravity gun', { exact: true }).tap();
    await page.waitForTimeout(2000);
    results.loadToolChangeDpr.afterGravity = await actualDpr();
    await finish(page, 'mobile-fixed-cpu-load');
    await page.evaluate(() => { window.__CAMERA_RATE_LOAD_MS__ = 0; });
    await begin(page);
    await page.waitForTimeout(2000);
    await finish(page, 'mobile-budget-recovery');
    if (process.env.EXPECT_DPR_BUDGET === '1') {
      assert.ok(results['mobile-fixed-cpu-load'].finalDpr < results['mobile-idle-budget'].finalDpr, 'Loaded frame time did not reduce the actual canvas DPR');
      assert.equal(results['mobile-budget-recovery'].finalDpr, results['mobile-fixed-cpu-load'].finalDpr, 'Recovery at 60 Hz raised the canvas DPR without headroom');
      // Telemetry updates once per 20-frame measurement window.
      assert.ok(results['mobile-fixed-cpu-load'].dprMismatchRenders <= 20, 'Canvas DPR did not match the policy after its next measurement window');
      assert.equal(results.loadToolChangeDpr.afterTorch, results.loadToolChangeDpr.before, 'Tool change reset the loaded canvas DPR');
      assert.equal(results.loadToolChangeDpr.afterGravity, results.loadToolChangeDpr.before, 'Tool change reset the loaded canvas DPR');
    }
    await context.close();
  } else {
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const desktop = await prepare(desktopContext);
  await desktop.mouse.move(550, 220);
  await desktop.mouse.down();
  await begin(desktop);
  for (let index = 1; index <= 80; index++) { await desktop.mouse.move(550 + index * 2, 220 + index * 0.4); await wait(12); }
  await desktop.mouse.up();
  const desktopLook = await finish(desktop, 'desktop-look');
  assert.ok(desktopLook.lookChanges > 5, 'Desktop drag did not turn the camera');

  await desktop.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  await desktop.mouse.move(650, 240);
  await desktop.mouse.down();
  await begin(desktop);
  for (let index = 1; index <= 30; index++) { await desktop.mouse.move(650 + index * 2, 240); await wait(12); }
  await desktop.mouse.up();
  const frozenDesktopLook = await finish(desktop, 'desktop-look-frozen-sim');
  assert.equal(frozenDesktopLook.distinctTicks, 1);
  assert.ok(frozenDesktopLook.sameTickLook > 5, 'Desktop view waited for a game tick');
  await desktop.evaluate(() => { window.__WRECK_YARD_CONTROLLER__.setPaused(false); window.__SET_LOOK_ANGLES__(Math.PI, 0); });
  await desktop.waitForTimeout(100);
  await desktop.keyboard.down('KeyW');
  await desktop.waitForTimeout(200);
  await begin(desktop);
  await desktop.waitForTimeout(1200);
  await desktop.keyboard.up('KeyW');
  await finish(desktop, 'desktop-walk');
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const mobile = await prepare(mobileContext);
  await mobile.getByLabel('Equip torch', { exact: true }).tap();
  const primary = await mobile.getByLabel('Cut', { exact: true }).boundingBox();
  assert.ok(primary, 'Mobile primary control missing');
  const cdp = await mobileContext.newCDPSession(mobile);
  const touch = async (type, dx = 0) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1, x: primary.x + primary.width / 2 - dx, y: primary.y + primary.height / 2 }],
  });
  await touch('touchStart');
  await begin(mobile);
  for (let index = 1; index <= 80; index++) { await touch('touchMove', index * 2); await wait(12); }
  await touch('touchEnd');
  const mobileLook = await finish(mobile, 'mobile-look');
  assert.ok(mobileLook.lookChanges > 5, 'Mobile primary drag did not turn the camera');
  await mobile.evaluate(() => window.__WRECK_YARD_CONTROLLER__.setPaused(true));
  await touch('touchStart');
  await begin(mobile);
  for (let index = 1; index <= 30; index++) { await touch('touchMove', index * 2); await wait(12); }
  await touch('touchEnd');
  const frozenMobileLook = await finish(mobile, 'mobile-look-frozen-sim');
  assert.equal(frozenMobileLook.distinctTicks, 1);
  assert.ok(frozenMobileLook.sameTickLook > 5, 'Mobile view waited for a game tick');
  await mobile.evaluate(() => { window.__WRECK_YARD_CONTROLLER__.setPaused(false); window.__SET_LOOK_ANGLES__(Math.PI, 0); });
  await mobile.waitForTimeout(100);
  const movePad = await mobile.getByLabel('Move pad', { exact: true }).boundingBox();
  const x = movePad.x + 70, y = movePad.y + 100;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x, y: y - 40 }] });
  await mobile.waitForTimeout(200);
  await begin(mobile);
  await mobile.waitForTimeout(1200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await finish(mobile, 'mobile-walk');
  await mobileContext.close();
  }
  assert.deepEqual(results.errors, []);
  if (process.env.EXPECT_CAMERA_INTERPOLATION === '1') {
    assert.ok(results['desktop-walk'].sameTickWalk > 5, 'Desktop walk camera did not move between ticks');
    assert.ok(results['mobile-walk'].sameTickWalk > 5, 'Mobile walk camera did not move between ticks');
  }
  results.status = 'passed';
} catch (error) {
  results.status = 'failed';
  results.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  await writeFile(new URL(`${label}-results.json`, output), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}
