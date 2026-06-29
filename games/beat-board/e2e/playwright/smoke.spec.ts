/**
 * Beat Board smoke tests.
 * Run: npm run test:e2e
 */

import { test, expect } from './fixtures';

test.describe('@smoke @remote-safe App smoke tests', () => {
  test('renders the ready shell and primary Play content', async ({ gamePage }) => {
    await gamePage.goto('/');

    await expect(gamePage.page.getByTestId('app-shell')).toBeVisible();
    await expect(gamePage.page.getByTestId('pad-grid-stage')).toBeVisible();
    await expect(gamePage.page.getByTestId('pad-top-bar-title')).toBeVisible();
    await expect(gamePage.page.locator('[data-testid^="pad-block-grid-"]').first()).toBeVisible();
    await expect(gamePage.page.locator('[data-ftue="pad-cell-0"]').first()).toBeVisible();
  });

  test('supports a visible primary interaction after startup', async ({ gamePage }) => {
    await gamePage.goto('/');
    const firstPad = gamePage.page.locator('[data-ftue="pad-cell-0"]').first();
    await expect(firstPad).toBeVisible();
    await firstPad.click();
    await expect(firstPad).toHaveAttribute('aria-pressed', 'true');
  });

  test('starts without observable startup request failures', async ({ gamePage }) => {
    await gamePage.goto('/');
    expect(gamePage.getStartupRequestFailures()).toEqual([]);
  });
});
