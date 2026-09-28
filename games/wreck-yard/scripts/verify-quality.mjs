// Live check for render quality tiers: HUD toggle and automatic fallback under load.
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4400 --strictPort
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.AUDIT_URL ?? 'http://127.0.0.1:4400';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.__WRECK_YARD_CONTROLLER__?.getRender()?.frame ?? 0) > 30, null, { timeout: 60000 });
  const label = () => page.getByRole('button', { name: /^Graphics:/ }).innerText();
  const framesAdvance = async () => {
    const start = await page.evaluate(() => window.__WRECK_YARD_CONTROLLER__.getRender().frame);
    await page.waitForFunction((s) => window.__WRECK_YARD_CONTROLLER__.getRender().frame > s + 10, start, { timeout: 15000 });
  };

  results.defaultTier = await label();
  assert.equal(results.defaultTier, 'Graphics: High');

  // Automatic fallback: slow the CPU until frames exceed the budget.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.waitForFunction(() => document.body.innerText.includes('Graphics: Low'), null, { timeout: 60000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  results.afterSlowFrames = await label();
  await framesAdvance();

  // Manual toggle both ways keeps rendering.
  await page.getByRole('button', { name: /^Graphics:/ }).click();
  await framesAdvance();
  results.afterToggle = await label();
  assert.equal(results.afterToggle, 'Graphics: High');
  await page.getByRole('button', { name: /^Graphics:/ }).click();
  await framesAdvance();
  results.afterSecondToggle = await label();
  assert.equal(results.afterSecondToggle, 'Graphics: Low');
  results.errors = errors;
  assert.deepEqual(errors, []);
} catch (error) {
  console.log(JSON.stringify(results, null, 1));
  throw error;
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 1));
