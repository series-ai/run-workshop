import { test, expect } from './fixtures';

test.describe('@desktop @local-only Performance overlay', () => {
  test('can be enabled from the debug console and remains visible after closing the sheet', async ({
    gamePage,
  }) => {
    await gamePage.goto('/');

    await gamePage.page.keyboard.press('`');

    const performanceModule = gamePage.page.locator('[data-debug-console-module-id="performance"]');
    await expect(performanceModule).toBeVisible();
    await performanceModule.getByRole('button', { name: 'Show Overlay' }).click();

    const overlay = gamePage.page.getByTestId('debug-performance-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('FPS');
    await expect(overlay).toContainText('Memory');

    await gamePage.page.keyboard.press('`');

    await expect(gamePage.page.getByTestId('debug-console-shell')).toBeHidden();
    await expect(overlay).toBeVisible();
  });
});
