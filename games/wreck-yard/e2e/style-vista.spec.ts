import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import { analyzeImageMetrics } from '../scripts/style-metrics.mjs';

const VISTA_CAMERA = {
  pos: [16, 9, 17] as [number, number, number],
  lookAt: [0, 1.5, -4] as [number, number, number],
};

type VistaWindow = Window & {
  __SET_CAMERA_OVERRIDE__: (pos: [number, number, number], lookAt: [number, number, number]) => void;
  __THREE_RENDERER__: { info: { render: { calls: number } } };
  __DEBUG_THREE__: { camera: { position: { toArray(): number[] } } };
};

test.describe('Wreck Yard Style Vista E2E', () => {
  let server: ViteDevServer | undefined;
  let devUrl: string;

  test.beforeAll(async () => {
    server = await createServer({
      root: path.resolve('.'),
      server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false },
    });
    try {
      await server.listen();
      const address = server.httpServer?.address();
      if (!address || typeof address === 'string') throw new Error('Style server has no TCP address.');
      devUrl = `http://127.0.0.1:${address.port}`;
    } catch (error) {
      await server.close();
      throw error;
    }
  });

  test.afterAll(async () => {
    await server?.close();
  });

  test('captures vista camera view and records baseline style metrics', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${devUrl}/?capture=off`);

    await expect(page.getByText('Wreck Yard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);

    const orbit = page.getByRole('button', { name: 'Orbit (O)', exact: true });
    await orbit.click();
    await expect(orbit).toHaveAttribute('aria-pressed', 'true');

    const testResultsDir = path.resolve('test-results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    await page.waitForFunction(() => {
      const win = window as VistaWindow;
      return typeof win.__SET_CAMERA_OVERRIDE__ === 'function'
        && typeof win.__THREE_RENDERER__?.info?.render?.calls === 'number'
        && typeof win.__DEBUG_THREE__?.camera?.position?.toArray === 'function';
    });

    await page.evaluate((cam) => {
      (window as VistaWindow).__SET_CAMERA_OVERRIDE__(cam.pos, cam.lookAt);
    }, VISTA_CAMERA);
    await expect.poll(() => page.evaluate(() =>
      (window as VistaWindow).__DEBUG_THREE__.camera.position.toArray(),
    )).toEqual(VISTA_CAMERA.pos);

    // Allow frames to stabilize.
    await page.waitForTimeout(1000);

    const screenshotPath = path.join(testResultsDir, 'style-vista.png');
    await page.screenshot({ path: screenshotPath, timeout: 15_000, animations: 'disabled' });
    expect(fs.existsSync(screenshotPath)).toBe(true);

    const renderCalls = await page.evaluate(() => {
      return (window as VistaWindow).__THREE_RENDERER__.info.render.calls;
    });

    const metrics = analyzeImageMetrics(screenshotPath);
    console.log('--- Vista Style Metrics ---');
    console.log(`Render calls: ${renderCalls}`);
    console.log(JSON.stringify(metrics, null, 2));

    // A2 inkFraction assertion
    expect(metrics.inkFraction).toBeGreaterThanOrEqual(0.03);
    expect(metrics.inkFraction).toBeLessThanOrEqual(0.12);

    // A7 metrics assertions
    expect(metrics.medianLuma).toBeGreaterThanOrEqual(40);
    expect(metrics.medianLuma).toBeLessThanOrEqual(62);
    expect(metrics.darkFraction24).toBeLessThanOrEqual(0.12);
    expect(metrics.brightFraction).toBeGreaterThanOrEqual(0.003);
    expect(metrics.brightFraction).toBeLessThanOrEqual(0.03);

    // Draw call budget assertion
    expect(renderCalls).toBeLessThanOrEqual(16);

    expect(pageErrors).toEqual([]);
  });
});
