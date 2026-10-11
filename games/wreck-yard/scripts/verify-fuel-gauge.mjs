// Check fuel feedback with real thrust and recharge in Chrome.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const output = new URL('../test-results/fuel-gauge/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { status: 'running', cases: {}, contextualUse: 'The existing Use prompt has priority over the mobile fuel gauge.' };
let activePage;
let activeCase;
try {
  for (const profile of [
    { name: 'desktop', mobile: false, reduced: false, viewport: { width: 1440, height: 900 }, interrupts: [] },
    { name: 'landscape', mobile: true, reduced: false, viewport: { width: 844, height: 390 }, interrupts: ['pulse', 'fade'] },
    { name: 'reduced-motion', mobile: true, reduced: true, viewport: { width: 844, height: 390 }, interrupts: ['fade'] },
  ]) {
    activeCase = profile.name;
    const context = await browser.newContext({
      viewport: profile.viewport, isMobile: profile.mobile, hasTouch: profile.mobile,
      reducedMotion: profile.reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1,
      ...(profile.mobile ? { userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' } : {}),
    });
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/?capture=off`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 35, null, { timeout: 60000 });
    await page.locator('.yard-fuel').waitFor({ state: 'attached' });
    await page.evaluate(() => {
      const report = { samples: [], events: [] };
      const read = () => {
        const render = window.__WRECK_YARD_CONTROLLER__.getRender();
        const player = render.players.find((entry) => entry.slot === render.localSlot);
        const gauge = document.querySelector('.yard-fuel');
        const style = getComputedStyle(gauge);
        const animation = gauge.getAnimations()[0];
        const timing = animation?.effect.getComputedTiming();
        const matrix = new DOMMatrixReadOnly(style.transform);
        return {
          time: performance.now(), frame: render.frame, fuel: player.fuel, burning: player.jetpackActive,
          state: gauge.dataset.state, ariaHidden: gauge.getAttribute('aria-hidden'),
          opacity: Number(style.opacity), visibility: style.visibility, scale: matrix.a,
          visible: style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.01,
          animation: style.animationName,
          progress: animation && Number(timing.duration) > 0 ? Number(animation.currentTime) / Number(timing.duration) : null,
        };
      };
      window.__FUEL_AUDIT__ = report;
      window.__READ_FUEL_AUDIT__ = read;
      const sample = () => { report.samples.push(read()); requestAnimationFrame(sample); };
      requestAnimationFrame(sample);
      for (const type of ['animationstart', 'animationend', 'animationcancel']) {
        document.addEventListener(type, (event) => {
          if (!event.target.matches('.yard-fuel')) return;
          report.events.push({ type, name: event.animationName, ...read() });
        }, true);
      }
    });
    const state = () => page.evaluate(() => window.__READ_FUEL_AUDIT__());
    const starts = () => page.evaluate(() => window.__FUEL_AUDIT__.events.filter((event) => event.type === 'animationstart').length);
    const screenshot = (name) => page.screenshot({ path: fileURLToPath(new URL(`${profile.name}-${name}.png`, output)) });
    const waitState = (target) => page.waitForFunction((value) => document.querySelector('.yard-fuel')?.dataset.state === value, target, { timeout: 30000 });
    const cdp = profile.mobile ? await context.newCDPSession(page) : null;
    let finger = null;
    const jetDown = async () => {
      if (!profile.mobile) { await page.keyboard.down('Space'); return; }
      const box = await page.getByRole('button', { name: 'Jet', exact: true }).boundingBox();
      assert.ok(box, 'Jet action is missing');
      finger = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    };
    const jetUp = async () => {
      if (!profile.mobile) { await page.keyboard.up('Space'); return; }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [finger] });
      finger = null;
    };
    const assertJet = async () => {
      if (profile.mobile) assert.equal(await page.getByRole('button', { name: 'Jet', exact: true }).isVisible(), true, 'Fuel state hid the Jet action');
    };
    const useFuel = async () => {
      await jetDown();
      await page.waitForFunction(() => window.__READ_FUEL_AUDIT__().fuel < 94, null, { timeout: 10000 });
      await waitState('visible');
      const used = await state();
      assert.equal(used.visible, true, 'Used fuel gauge is not visible');
      assert.equal(used.ariaHidden, 'false', 'Used fuel is hidden from accessibility');
      assert.ok(used.fuel < 100, 'Thrust did not use real fuel');
      assert.equal(used.animation, 'none', 'Used fuel kept the completion animation');
      await assertJet();
      await jetUp();
      return used;
    };
    const waitCharged = async (expectedStarts) => {
      await waitState('charged');
      await page.waitForFunction((count) => window.__FUEL_AUDIT__.events.filter((event) => event.type === 'animationstart').length >= count, expectedStarts, { timeout: 3000 });
      const charged = await state();
      assert.equal(charged.fuel, 100, 'Gauge pulsed before actual full recharge');
      assert.equal(charged.burning, false, 'Gauge completed during thrust');
      assert.equal(charged.ariaHidden, 'false');
      await assertJet();
      return charged;
    };
    const waitHidden = async (expectedStarts) => {
      await waitState('hidden');
      const hidden = await state();
      assert.equal(hidden.fuel, 100);
      assert.equal(hidden.visible, false, 'Full gauge remained visible after completion');
      assert.equal(hidden.ariaHidden, 'true');
      assert.equal(await starts(), expectedStarts, 'Recharge pulse repeated');
      await assertJet();
      return hidden;
    };

    const initial = await state();
    assert.equal(initial.fuel, 100);
    assert.equal(initial.state, 'hidden', 'Full gauge starts visible');
    assert.equal(initial.visible, false);
    assert.equal(initial.ariaHidden, 'true');
    await page.waitForTimeout(350);
    assert.equal(await starts(), 0, 'Initial full fuel pulsed');
    await assertJet();
    await screenshot('initial');
    const used = await useFuel();
    await screenshot('used');
    let expectedStarts = 1;
    const charged = await waitCharged(expectedStarts);
    await screenshot('charged');
    const hidden = await waitHidden(expectedStarts);
    await screenshot('hidden');
    const interruptions = [];
    for (const stage of profile.interrupts) {
      await useFuel();
      expectedStarts += 1;
      await waitCharged(expectedStarts);
      if (stage === 'fade') {
        await page.waitForFunction(() => {
          const gauge = window.__READ_FUEL_AUDIT__();
          return gauge.state === 'charged' && gauge.opacity < 0.85 && gauge.opacity > 0.15;
        }, null, { timeout: 3000 });
      }
      const before = await state();
      assert.equal(before.state, 'charged', `Could not interrupt ${stage}`);
      if (stage === 'pulse') assert.ok(before.progress < 0.55, 'Pulse interruption started after the fade');
      if (stage === 'fade') assert.ok(before.opacity < 0.85, 'Fade interruption started before opacity changed');
      await jetDown();
      await page.waitForFunction(() => window.__READ_FUEL_AUDIT__().fuel < 94, null, { timeout: 10000 });
      await waitState('visible');
      const reused = await state();
      assert.equal(reused.animation, 'none', 'New thrust did not cancel full-fuel animation');
      assert.equal(reused.visible, true, 'New thrust stayed hidden');
      assert.equal(reused.ariaHidden, 'false');
      // Continue real thrust beyond the old animation deadline.
      await page.waitForTimeout(profile.reduced ? 800 : 1200);
      const afterDeadline = await state();
      assert.ok(afterDeadline.fuel < 100);
      assert.equal(afterDeadline.state, 'visible', 'Old completion hid newly used fuel');
      assert.equal(afterDeadline.visible, true);
      await assertJet();
      await screenshot(`${stage}-interrupted`);
      await jetUp();
      expectedStarts += 1;
      await waitCharged(expectedStarts);
      await waitHidden(expectedStarts);
      interruptions.push({ stage, before, reused, afterDeadline });
    }
    await page.waitForTimeout(400);
    assert.equal(await starts(), expectedStarts, 'Idle full fuel pulsed again');
    const report = await page.evaluate(() => window.__FUEL_AUDIT__);
    const pulseSamples = report.samples.filter((sample) => sample.state === 'charged');
    const pulseEvents = report.events.filter((event) => event.type === 'animationstart');
    assert.ok(pulseSamples.length > 5, 'Completion animation was not observed');
    for (const event of pulseEvents) {
      assert.equal(event.fuel, 100, 'A completion started below actual full fuel');
      assert.equal(event.name, profile.reduced ? 'yard-fuel-full-reduced' : 'yard-fuel-full');
    }
    assert.ok(pulseSamples.some((sample) => sample.opacity < 0.5), 'Completion did not fade');
    const maxScale = Math.max(...pulseSamples.map((sample) => sample.scale));
    if (profile.reduced) assert.ok(maxScale <= 1.001, 'Reduced motion still scales the gauge');
    else assert.ok(maxScale > 1.02, 'Full recharge did not pulse');
    assert.deepEqual(errors, []);
    results.cases[profile.name] = { status: 'passed', initial, used, charged, hidden, expectedStarts, maxScale, interruptions, events: report.events, errors };
    await writeFile(new URL(`${profile.name}-samples.json`, output), JSON.stringify(report, null, 2));
    console.log(`Fuel gauge passed: ${profile.name}`);
    await context.close();
    activePage = null;
  }
  results.status = 'passed';
} catch (error) {
  results.status = 'failed';
  results.failure = { case: activeCase, message: error.message, stack: error.stack };
  if (activePage) {
    results.failure.live = await activePage.evaluate(() => window.__READ_FUEL_AUDIT__?.()).catch(() => null);
    const report = await activePage.evaluate(() => window.__FUEL_AUDIT__).catch(() => null);
    await writeFile(new URL(`${activeCase}-samples.json`, output), JSON.stringify(report, null, 2));
    await activePage.screenshot({ path: fileURLToPath(new URL('failure.png', output)) }).catch(() => {});
  }
  throw error;
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify(results));
