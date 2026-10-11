// Uses the real browser audio graph and local sound files.
// Start the dev server, then run AUDIT_URL=http://127.0.0.1:4481 node scripts/verify-audio.mjs.
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4481';
const out = process.env.AUDIO_OUT ?? fileURLToPath(new URL('../test-results/audio/', import.meta.url));
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
let lastPage;
const count = value => Array.isArray(value) ? value.length : value;
try {
  for (const mobile of process.env.AUDIO_CHECKS === 'lifecycle' ? [] : [false, true]) {
    const name = mobile ? 'mobile' : 'desktop';
    const context = await browser.newContext(mobile
      ? { ...devices['Pixel 7'], viewport: { width: 844, height: 390 } }
      : { viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    lastPage = page;
    results[name] = { phase: 'boot' };
    const errors = [];
    const audioResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/audio/')) audioResponses.push({ url: response.url(), status: response.status() }); });
    const audio = () => page.evaluate(() => window.__DEBUG_AUDIO__?.() ?? null);
    const activate = async locator => mobile ? locator.tap() : locator.click();
    const has = async locator => await locator.count() > 0 && await locator.first().isVisible();
    const engage = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const windowButton = page.getByRole('button', { name: /Play in a window/ });
        const playButton = page.getByRole('button', { name: /^Click to play$|^Resume$|^Resume fullscreen$/ });
        if (await has(windowButton)) await activate(windowButton.first());
        else if (await has(playButton)) await activate(playButton.first());
        else { await activate(mobile ? page.getByLabel('Look pad', { exact: true }) : page.locator('canvas').first()); break; }
        await page.waitForTimeout(150);
        if ((await audio())?.active) break;
      }
    };
    await page.goto(`${base}/?capture=off&quality=low`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__?.getRender(), null, { timeout: 60000 });
    const before = await audio();
    results[name] = { phase: 'gesture', before };
    if (before) {
      assert.equal(count(before.voices), 0, `${name}: sound before a gesture`);
      assert.equal(count(before.loops), 0, `${name}: loop before a gesture`);
      assert.notEqual(before.contextState, 'running', `${name}: context ran before a gesture`);
    }
    await engage();
    await page.waitForFunction(() => typeof window.__DEBUG_AUDIO__ === 'function' && window.__DEBUG_AUDIO__().status === 'ready' && window.__DEBUG_AUDIO__().contextState === 'running' && window.__DEBUG_AUDIO__().active, null, { timeout: 45000 });
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().outputRms > 0.00001);
    const unlocked = await audio();
    results[name] = { phase: 'gameplay', before, unlocked };
    assert.equal(unlocked.settings.ambience, 0.12);
    assert.equal(unlocked.settings.effects, 0.7);
    assert.ok(audioResponses.length > 0, 'no real sound files were loaded');
    assert.ok(audioResponses.every(r => r.status === 200), JSON.stringify(audioResponses));
    assert.ok(audioResponses.some(r => r.url.endsWith('/city-hum.mp3')));
    assert.ok(!audioResponses.some(r => r.url.endsWith('/yard-ambient.mp3')));
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().played.some(p => p.sound === 'distantSteam'), null, { timeout: 35000 });
    const background = await audio();
    assert.equal(background.played.filter(p => p.sound === 'distantSteam').length, 1, 'background replayed a scheduled sound');
    assert.ok(background.outputRms > 0.00001, 'background graph produced no signal');

    const shotCount = unlocked.played.length;
    await page.keyboard.press('Digit2');
    await page.waitForFunction(n => window.__DEBUG_AUDIO__().played.slice(n).some(p => p.sound === 'switch'), shotCount);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => JSON.stringify(window.__DEBUG_AUDIO__().loops).includes('jet'));
    await page.waitForTimeout(150);
    const jet = await audio();
    assert.ok(jet.outputRms > 0.00001, 'jet graph produced no signal');
    await page.keyboard.up('Space');
    await page.waitForFunction(() => !JSON.stringify(window.__DEBUG_AUDIO__().loops).includes('jet'));

    // Aim at nearby ground. The real input and simulation must produce torch feedback.
    await page.evaluate(() => window.__SET_LOOK_ANGLES__(0, -1.2));
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__SIMULATE_INPUT__({ tool: 'torch', pressed: true }));
    await page.waitForFunction(() => JSON.stringify(window.__DEBUG_AUDIO__().loops).includes('torch'));
    const torch = await audio();
    await page.evaluate(() => window.__SIMULATE_INPUT__({ pressed: false }));
    await page.waitForFunction(() => !JSON.stringify(window.__DEBUG_AUDIO__().loops).includes('torch'));

    results[name] = { phase: 'pause', before, unlocked, jet, torch };
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    if (await has(pause)) await activate(pause);
    else await page.keyboard.press('Escape');
    await page.getByRole('region', { name: 'Paused', exact: true }).waitFor();
    await page.waitForFunction(() => { const d = window.__DEBUG_AUDIO__(); return !d.active && (Array.isArray(d.voices) ? d.voices.length : d.voices) === 0 && (Array.isArray(d.loops) ? d.loops.length : d.loops) === 0; });
    await page.waitForTimeout(150);
    const paused = await audio();
    assert.ok(paused.outputRms < 0.00001, 'pause left audio output');
    await page.screenshot({ path: `${out}/pause-${name}.png`, scale: 'css' });
    const ambience = page.getByRole('slider', { name: 'Ambience', exact: true });
    const effects = page.getByRole('slider', { name: 'Effects', exact: true });
    await ambience.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await effects.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    const levels = await audio();
    results[name] = { phase: 'controls', before, unlocked, background, jet, torch, paused, levels };
    assert.ok(levels.settings.ambience > 0 && levels.settings.ambience < 0.12);
    assert.ok(levels.settings.effects > 0.7 && levels.settings.effects < 1);
    await activate(page.getByRole('checkbox', { name: 'Mute sound', exact: true }));
    assert.equal((await audio()).settings.muted, true);
    await engage();
    await page.waitForTimeout(300);
    const muted = await audio();
    assert.equal(count(muted.voices), 0);
    assert.equal(count(muted.loops), 0);
    assert.ok(muted.outputRms < 0.00001, 'mute left audio output');
    if (await has(pause)) await activate(pause);
    else await page.keyboard.press('Escape');
    const unmute = page.getByRole('checkbox', { name: 'Mute sound', exact: true });
    await activate(unmute);
    assert.equal((await audio()).settings.muted, false);
    const oldShots = (await audio()).played.map(p => p.id);
    await engage();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().active && window.__DEBUG_AUDIO__().contextState === 'running');
    await page.waitForTimeout(1000);
    const resumed = await audio();
    const newShots = resumed.played.slice(oldShots.length);
    assert.ok(!newShots.some(s => oldShots.includes(s.id)), 'resume repeated an old action');
    assert.ok(count(resumed.voices) <= 24 && count(jet.voices) <= 24 && count(torch.voices) <= 24, 'voice limit exceeded');
    assert.ok(count(resumed.loops) <= 9, 'loop limit exceeded');
    assert.deepEqual(errors, [], `${name}: browser errors`);
    console.log(name, 'passed');
    results[name] = { before, unlocked, background, jet, torch, paused, levels, muted, resumed, audioResponses, errors };
    await context.close();
  }
  // Delay real asset responses. Pause before decode completes.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    lastPage = page;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let requests = 0;
    await page.route('**/audio/*.mp3', async route => {
      requests++;
      await barrier;
      await route.continue().catch(() => {});
    });
    await page.goto(`${base}/?capture=off&quality=low`);
    await page.waitForFunction(() => window.__WRECK_YARD_CONTROLLER__?.getRender());
    await page.locator('canvas').click();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__?.().status === 'loading');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__DEBUG_AUDIO__().active);
    assert.ok(requests > 0, 'no asset response was delayed');
    release();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().status === 'ready');
    await page.waitForTimeout(200);
    const loadedWhilePaused = await page.evaluate(() => window.__DEBUG_AUDIO__());
    assert.equal(loadedWhilePaused.active, false);
    assert.equal(loadedWhilePaused.voices, 0);
    assert.deepEqual(loadedWhilePaused.loops, []);
    assert.equal(loadedWhilePaused.outputRms, 0);
    assert.equal(loadedWhilePaused.contextState, 'suspended');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().outputRms > 0.00001);
    const cover = await context.newPage();
    await cover.goto('about:blank');
    await cover.bringToFront();
    await page.waitForTimeout(250);
    const hidden = await page.evaluate(() => ({ hidden: document.hidden, audio: window.__DEBUG_AUDIO__() }));
    if (hidden.hidden) {
      assert.equal(hidden.audio.active, false);
      assert.equal(hidden.audio.voices, 0);
      assert.deepEqual(hidden.audio.loops, []);
      assert.equal(hidden.audio.outputRms, 0);
    }
    await page.bringToFront();
    await cover.close();
    await page.waitForFunction(() => window.__DEBUG_AUDIO__().active);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Leave match', exact: true }).click();
    await page.waitForTimeout(200);
    const leftMatch = await page.evaluate(() => window.__DEBUG_AUDIO__());
    assert.equal(leftMatch.active, false);
    assert.equal(leftMatch.voices, 0);
    assert.deepEqual(leftMatch.loops, []);
    assert.equal(leftMatch.outputRms, 0);
    assert.deepEqual(errors, []);
    results.lifecycle = { delayedRequests: requests, loadedWhilePaused, tabVisibility: hidden, leftMatch, errors };
    await context.close();
  }
} finally {
  if (lastPage && !lastPage.isClosed()) {
    await lastPage.screenshot({ path: `${out}/last-page.png`, scale: 'css' }).catch(() => {});
    results.lastState = await lastPage.evaluate(() => window.__DEBUG_AUDIO__?.()).catch(() => null);
  }
  await fs.writeFile(`${out}/${process.env.AUDIO_CHECKS === 'lifecycle' ? 'lifecycle-receipt' : 'receipt'}.json`, JSON.stringify(results, null, 2));
  await browser.close();
  console.log(`Audio receipt: ${out}/${process.env.AUDIO_CHECKS === 'lifecycle' ? 'lifecycle-receipt' : 'receipt'}.json`);
}
