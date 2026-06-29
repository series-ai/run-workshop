import { test, expect } from './fixtures';
import { DEBUG_CONSOLE_TOUCH_HOLD_MS } from '../../src/debug-console/useDebugConsoleTouchGesture';

test.describe('@desktop @local-only Debug console', () => {
  test('opens from backquote and shows diagnostics', async ({ gamePage }) => {
    await gamePage.goto('/');

    await gamePage.page.keyboard.press('`');

    const shell = gamePage.page.getByTestId('debug-console-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toContainText('Debug Console');
    await expect(shell).toContainText('Current Screen');
    await expect(shell).toContainText('play');
    await expect(shell).toContainText('Access Role');
    await expect(shell).toContainText('player');
  });

  test('executes a discovered navigation command through the palette', async ({ gamePage }) => {
    await gamePage.goto('/');

    await gamePage.page.keyboard.press('`');

    const shell = gamePage.page.getByTestId('debug-console-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toContainText('Open Screen');

    await shell.getByRole('button', { name: 'Open Screen' }).click();
    await shell.getByLabel('Open Screen Screen').selectOption('settings');
    await shell.getByRole('button', { name: 'Run Command' }).click();

    await expect(shell).toContainText('Execution Log');
    await expect(shell).toContainText('open-screen');
    await expect(shell).toContainText('success');
    await expect(shell).toContainText('settings');
  });

  test('keeps editor-only commands hidden for players in production preview', async ({
    gamePage,
  }) => {
    await gamePage.goto('/');

    await gamePage.page.keyboard.press('`');

    const shell = gamePage.page.getByTestId('debug-console-shell');
    await expect(shell).toBeVisible();
    await expect(shell).toContainText('Open Screen');
    await expect(shell).not.toContainText('Execute Recipe');
  });
});

test.describe('@mobile @local-only Debug console mobile gesture', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });

  test('opens from a simultaneous three-finger hold', async ({ gamePage }) => {
    await gamePage.goto('/');

    await gamePage.page.evaluate(async (holdMs) => {
      const dispatchTouch = (
        type: 'touchstart' | 'touchmove' | 'touchend',
        points: Array<{ identifier: number; clientX: number; clientY: number }>,
      ) => {
        const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
        Object.defineProperty(event, 'touches', {
          configurable: true,
          value: points,
        });
        window.dispatchEvent(event);
      };

      dispatchTouch('touchstart', [
        { identifier: 1, clientX: 10, clientY: 10 },
        { identifier: 2, clientX: 40, clientY: 10 },
        { identifier: 3, clientX: 70, clientY: 10 },
      ]);

      await new Promise((resolve) => window.setTimeout(resolve, holdMs + 50));
    }, DEBUG_CONSOLE_TOUCH_HOLD_MS);

    await expect(gamePage.page.getByTestId('debug-console-shell')).toBeVisible();
    await expect(gamePage.page.getByTestId('debug-console-shell')).toContainText('Debug Console');
  });
});
