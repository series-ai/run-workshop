// Draw calls per pinned tier (cruise and boosting), cold start, adapter, console errors.
const { createRequire } = require('module');
const req = require;
const { chromium } = req(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.argv[2];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const out = {};
  for (const tier of ['high', 'medium', 'low']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 400)); if (m.text().includes('gl adapter')) out.adapter = m.text(); });
    page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
    const t0 = Date.now();
    await page.goto(`${url}?tier=${tier}`);
    await page.waitForFunction(() => window.__skyriver && window.__skyriver.stats().firstFrameMs !== null, null, { timeout: 20000 });
    const bootMs = Date.now() - t0;
    await page.waitForTimeout(3000);
    const cruise = await page.evaluate(() => { const s = window.__skyriver.stats(); return { calls: s.drawCalls, firstFrameMs: s.firstFrameMs, fps: +s.fps.toFixed(1), cars: s.cars }; });
    await page.keyboard.down('KeyB'); await page.waitForTimeout(900);
    const boost = await page.evaluate(() => window.__skyriver.stats().drawCalls);
    await page.keyboard.up('KeyB');
    out[tier] = { bootMs, ...cruise, boostCalls: boost, errors: logs };
    await page.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
