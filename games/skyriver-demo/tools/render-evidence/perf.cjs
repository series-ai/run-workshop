// Uncapped frame time (vsync and frame-rate limit off), alternating query variants over REPEATS
// rounds, 600 frames each from 4 s in. usage: node perf.cjs URL DSF q1 q2 ...
const { createRequire } = require('module');
const req = require;
const { chromium } = req(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [url, dsf, ...queries] = process.argv.slice(2);
const REPEATS = Number(process.env.REPEATS || 3);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  const out = {};
  for (let r = 0; r < REPEATS; r += 1) for (const q of queries) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(dsf) });
    const logs = [];
    page.on('console', m => { if (m.type() === 'error' || m.text().includes('gl adapter')) logs.push(m.text()); });
    page.on('pageerror', e => logs.push(e.message));
    await page.goto(url + q); await page.waitForTimeout(4000);
    const res = await page.evaluate(async () => {
      const t = []; let last = performance.now();
      await new Promise((done) => { const f = (now) => { t.push(now - last); last = now; if (t.length < 600) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      t.sort((a, b) => a - b);
      return { avg: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)], calls: window.__skyriver.stats().drawCalls, pr: window.__skyriver.scene.renderer.getPixelRatio() };
    });
    res.logs = logs;
    (out[q || 'default'] ??= []).push(res); await page.close();
  }
  const summary = {};
  for (const [k, v] of Object.entries(out)) {
    const avgs = v.map((x) => x.avg).sort((a, b) => a - b);
    summary[k] = { medianAvgMs: +avgs[Math.floor(avgs.length / 2)].toFixed(3), runsAvgMs: avgs.map((x) => +x.toFixed(3)), p95Ms: +v.map((x) => x.p95).sort((a, b) => a - b)[Math.floor(v.length / 2)].toFixed(3), calls: v[0].calls, pixelRatio: v[0].pr, logs: [...new Set(v.flatMap(x => x.logs))] };
  }
  console.log(JSON.stringify(summary, null, 1)); await browser.close();
})();
