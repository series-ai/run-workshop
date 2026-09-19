import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeImageMetrics } from '../scripts/style-metrics.mjs';

const VISTA_CAMERA = {
  pos: [16, 9, 17] as [number, number, number],
  lookAt: [0, 1.5, -4] as [number, number, number],
};

test.describe('Wreck Yard Style Vista E2E', () => {
  test('captures vista camera view and records baseline style metrics', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => console.log('[BROWSER]', msg.type(), msg.text()));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    await expect(page.getByText('Wreck Yard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByText('Status: live')).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);

    const testResultsDir = path.resolve('test-results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Apply camera override
    await page.evaluate((cam) => {
      const win = window as unknown as {
        __SET_CAMERA_OVERRIDE__?: (pos: [number, number, number] | null, lookAt?: [number, number, number] | null) => void;
      };
      if (typeof win.__SET_CAMERA_OVERRIDE__ === 'function') {
        win.__SET_CAMERA_OVERRIDE__(cam.pos, cam.lookAt);
      }
    }, VISTA_CAMERA);

    // Allow frames to stabilize
    await page.waitForTimeout(1000);

    const screenshotPath = path.join(testResultsDir, 'style-vista.png');
    await page.screenshot({ path: screenshotPath, timeout: 15_000, animations: 'disabled' });
    expect(fs.existsSync(screenshotPath)).toBe(true);

    const renderCalls = await page.evaluate(() => {
      const win = window as unknown as { __THREE_RENDERER__?: { info?: { render?: { calls?: number } } } };
      return win.__THREE_RENDERER__?.info?.render?.calls ?? null;
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
    if (renderCalls !== null) {
      expect(renderCalls).toBeLessThanOrEqual(16);
    }

    expect(pageErrors).toEqual([]);
  });
});
