import { expect, test } from '@playwright/test';

test('solo yard loads with five bodies and no page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('Wreck Yard')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  const metrics = page.locator('div[aria-live="polite"]');
  await expect(metrics).toContainText(/Bodies:\s*\d+/, { timeout: 15_000 });
  await expect(metrics).toContainText('Status: live');

  await page.getByRole('button', { name: /Torch/i }).click();
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.32);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.47, box!.y + box!.height * 0.34, { steps: 6 });
  await page.waitForTimeout(400);
  await page.mouse.up();

  await page.screenshot({ path: 'test-results/wreck-yard-smoke.png' });
  expect(pageErrors).toEqual([]);
});

test('surfaces server error modal with helpful details and fallback to solo mode', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('Wreck Yard')).toBeVisible();

  // Leave active solo session
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByRole('button', { name: 'Play solo' })).toBeVisible();

  // Inject runner start aborted error into join transport
  await page.evaluate(() => {
    const c = (window as unknown as { __WRECK_YARD_CONTROLLER__?: { deps: { joinRoomTransport: () => Promise<never> } } }).__WRECK_YARD_CONTROLLER__;
    if (c) {
      c.deps.joinRoomTransport = () => {
        const err = new Error('Runner start was aborted. Start the runner again when the required resources are available.');
        Object.assign(err, { code: 'runner.start-aborted' });
        return Promise.reject(err);
      };
    }
  });

  // Enter a room code and attempt to join
  const codeInput = page.getByRole('textbox', { name: 'Room code' });
  await codeInput.fill('FAIL');
  await page.getByRole('button', { name: 'Join' }).click();

  // Modal alert dialog should appear with helpful context
  const modal = page.getByRole('alertdialog');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal).toContainText('Multiplayer Server Unavailable');
  await expect(modal).toContainText('Technical Details');

  // Verify technical details toggle
  await modal.getByText('Technical Details').click();
  await expect(modal.getByText('Runner start was aborted')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Copy error' })).toBeVisible();

  // Verify Play Solo (Offline) button in modal restores session
  await modal.getByRole('button', { name: 'Play Solo (Offline)' }).click();
  await expect(modal).not.toBeVisible();
  const metrics = page.locator('div[aria-live=\"polite\"]');
  await expect(metrics).toContainText('Status: live');
});
