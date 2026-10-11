import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = resolve('.');
const out = resolve('test-results/ground-line');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false, root,
  esbuild: { target: 'es2022' },
  optimizeDeps: { entries: ['e2e/ground-ink.html'], esbuildOptions: { target: 'es2022' } },
  server: { host: '127.0.0.1', port: 4493, strictPort: true, hmr: false },
});
await server.listen();
let browser;
const results = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  for (const config of [
    { width: 1440, height: 900, samples: 4, precision: 'highp' },
    { width: 844, height: 390, samples: 0, precision: 'mediump' },
    { width: 1055, height: 487, samples: 0, precision: 'mediump' },
    { width: 390, height: 844, samples: 0, precision: 'mediump' },
  ]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4493/e2e/ground-ink.html?precision=${config.precision}`);
    await page.waitForFunction(() => typeof window.auditGroundInk === 'function');
    const result = await page.evaluate(c => window.auditGroundInk(c.width, c.height, c.samples), config);
    for (const row of result.cases) {
      if (row.withBox) {
        assert.ok(row.darkened > 50, 'The box must keep its ink outline.');
        assert.equal(row.outsideBox, 0, 'Ink must stay inside the box outline bounds.');
      } else {
        assert.equal(row.darkened, 0, 'A flat floor must have no ink edge.');
      }
    }
    assert.deepEqual(errors, []);
    results.push({ config, ...result });
    await page.close();
  }
  await writeFile(`${out}/gpu-results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS: ${results.length * 6} GPU cases. Flat floors stay clear. Box outlines remain.`);
} finally {
  await browser?.close();
  await server.close();
}
