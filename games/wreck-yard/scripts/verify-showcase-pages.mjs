import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const folder = fileURLToPath(new URL('../public/showcase/', import.meta.url));
const manifest = JSON.parse(await readFile(`${folder}audit/manifest.json`, 'utf8'));
assert.equal(manifest.results.length, 6, 'Expected six mechanic results');
assert.deepEqual(manifest.errors, [], 'Capture reported errors');
assert.ok(manifest.results.every(result => result.passed), 'A mechanic failed');
const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/showcase/index.html`);
    await page.getByRole('link', { name: 'Open current audit', exact: true }).click();
    assert.equal(await page.locator('video').count(), 6);
    const clips = [];
    for (let index = 0; index < 6; index++) {
      const video = page.locator('video').nth(index);
      await video.scrollIntoViewIfNeeded();
      const controls = page.locator('article').nth(index).getByRole('button');
      await controls.click();
      await page.waitForFunction(index => document.querySelectorAll('video')[index].currentTime > 0.2, index, { timeout: 10000 });
      const metadata = await video.evaluate(element => ({ duration: element.duration, width: element.videoWidth, height: element.videoHeight }));
      await controls.click();
      const currentTime = await video.evaluate(element => element.currentTime);
      assert.ok(await video.evaluate(element => element.paused), 'Pause button failed');
      assert.ok(metadata.duration > 1 && metadata.width > 0 && currentTime > .2);
      clips.push({ ...metadata, currentTime });
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Page overflows viewport');
    assert.deepEqual(errors, []);
    results.push({ width, clips, overflow, errors });
    await page.close();
  }
  // The play button must work when the local file is opened directly too.
  const filePage = await browser.newPage();
  await filePage.goto(new URL('../public/showcase/audit.html', import.meta.url).href);
  await filePage.getByRole('button', { name: 'Play video', exact: true }).first().click();
  await filePage.waitForFunction(() => document.querySelector('video').currentTime > .2);
  await filePage.close();
  await writeFile(`${folder}audit/playback-results.json`, JSON.stringify({ capturedAt: new Date().toISOString(), results, filePlayback: true }, null, 2));
  console.log('Six clips played at 390px and 1440px. Local file playback passed.');
} finally { await browser.close(); }
