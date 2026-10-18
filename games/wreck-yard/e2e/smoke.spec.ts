import { expect, test } from '@playwright/test';

test('a multiplayer yard starts with a room code and no page errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto('/?capture=off&quality=low');
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.yard-crew')).toHaveText('Crew 1/4');
  await expect(page.getByRole('button', { name: /solo/i })).toHaveCount(0);
  await page.getByRole('button', { name: /Plasma Torch/i }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const code = page.getByRole('textbox', { name: 'Your room code' });
  await expect(code).toHaveValue(/^[A-Z0-9]{6}$/);
  const ownCode = await code.inputValue();
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Join another room' }).fill(ownCode.toLowerCase());
  await expect(page.getByRole('button', { name: 'Join', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'test-results/multiplayer-pause.png' });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('[aria-label="Paused"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('a failed room join offers network recovery without offline play', async ({ page }) => {
  await page.goto('/?capture=off&quality=low');
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('textbox', { name: 'Join another room' }).fill('INVALID');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  const modal = page.getByRole('alertdialog');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await expect(modal.getByRole('button', { name: /solo/i })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await modal.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.yard-crew')).toHaveText('Crew 1/4');
});

test('pause shares a code and a second player can paste it to join', async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?capture=off&quality=low');
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 45_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const roomCode = await page.getByRole('textbox', { name: 'Your room code' }).inputValue();
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(roomCode);
  const guest = await context.newPage();
  guest.on('pageerror', error => pageErrors.push(String(error)));
  try {
    await guest.goto('/?capture=off&quality=low');
    await guest.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 45_000 });
    await guest.getByRole('button', { name: 'Pause', exact: true }).click();
    const input = guest.getByRole('textbox', { name: 'Join another room' });
    await input.focus();
    await input.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
    await expect(input).toHaveValue(roomCode);
    await guest.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(guest.locator('[data-match-status="live"]')).toBeVisible({ timeout: 45_000 });
    await expect(guest.locator('.yard-tape')).toHaveText(roomCode);
    await expect(guest.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await expect(page.locator('.yard-crew')).toHaveText('Crew 2/4', { timeout: 30_000 });
    await guest.screenshot({ path: 'test-results/multiplayer-joined.png' });
    expect(pageErrors).toEqual([]);
  } finally { await guest.close(); }
});
