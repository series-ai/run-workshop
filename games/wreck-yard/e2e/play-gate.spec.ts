import { expect, test, type Page } from '@playwright/test';

/** The fake capture port (src/game/capturePort.ts) that ?capture=fake puts on window. */
type Fake = {
  emit(state: { active: boolean; pointerLocked: boolean }): void;
  respond(result: { active: boolean; pointerLocked: boolean; reason?: string }): void;
  calls: string[];
};

const emit = (page: Page, active: boolean, pointerLocked: boolean) =>
  page.evaluate(([a, l]) => (window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.emit({ active: a, pointerLocked: l }), [active, pointerLocked] as const);
const calls = (page: Page) => page.evaluate(() => [...(window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.calls]);
const refuseNext = (page: Page) =>
  page.evaluate(() => (window as unknown as { __CAPTURE_FAKE__: Fake }).__CAPTURE_FAKE__.respond({ active: true, pointerLocked: false, reason: 'refused' }));

test('start plate, pause menu, resume, leave, and the drag-look fallback', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto('/?capture=fake', { waitUntil: 'networkidle' });

  // Start plate over the running yard.
  const gate = page.locator('[data-gate-view]');
  await expect(gate).toHaveAttribute('data-gate-view', 'start', { timeout: 15_000 });
  await expect(gate).toContainText('a multiplayer demo of the RUN Syncplay engine');
  await page.getByRole('button', { name: 'Click to play' }).click();
  await expect(gate).toHaveCount(0);
  expect(await calls(page)).toEqual(['requestFullscreen:true']);

  // Escape once: fullscreen with a free cursor opens the pause menu.
  await emit(page, true, false);
  await expect(gate).toHaveAttribute('data-gate-view', 'paused');
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await expect(gate).toContainText('Esc again: leave fullscreen');
  await expect(page.getByRole('navigation', { name: 'Tools' })).toHaveCount(0);

  // Escape twice: windowed, the menu stays, and Resume enters fullscreen again.
  await emit(page, false, false);
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume fullscreen' }).click();
  await expect(gate).toHaveCount(0);
  expect((await calls(page)).at(-1)).toBe('requestFullscreen:true');

  // Leave Match from the pause menu: the match menu shows with no gate over it.
  await emit(page, true, false);
  await page.getByRole('button', { name: 'Leave match' }).click();
  await expect(page.getByRole('button', { name: 'Play Solo' })).toBeVisible();
  await expect(gate).toHaveCount(0);

  // Play Solo captures in the same click, then the match goes live.
  await page.getByRole('button', { name: 'Play Solo' }).click();
  await expect(page.locator('[data-match-status="live"]')).toBeVisible({ timeout: 15_000 });
  await expect(gate).toHaveCount(0);
  expect(await calls(page)).toContain('setPointerLock:true');

  // Two refusals offer drag-to-look; that plays at once, and "Capture mouse" comes back.
  await emit(page, true, false);
  await refuseNext(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(gate).toContainText('Click Resume again');
  await refuseNext(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Play in a window (drag to look)' }).click();
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Capture mouse' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
