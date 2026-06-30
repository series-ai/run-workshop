/**
 * E2E test utilities — retry, multiplayer, orientation helpers.
 *
 * Import `test` and `expect` from fixtures.ts, not from @playwright/test.
 * Import helpers from this file.
 */

import { test, expect, GamePage } from './fixtures';
import type { Browser, BrowserContext } from '@playwright/test';

export { test, expect, GamePage };

// =============================================================================
// Retry wrapper for flaky canvas/timing tests
// =============================================================================

export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// =============================================================================
// Console error check wrapper
// =============================================================================

export async function withConsoleErrorCheck<T>(gamePage: GamePage, fn: () => Promise<T>): Promise<T> {
  gamePage.clearConsoleErrors();
  const result = await fn();
  gamePage.assertNoConsoleErrors();
  return result;
}

// =============================================================================
// Multiplayer helpers — multiple browser contexts
// =============================================================================

export interface MultiPlayerContext {
  pages: GamePage[];
  contexts: BrowserContext[];
}

/**
 * Create N isolated GamePage instances for multiplayer testing.
 * Each gets its own BrowserContext (separate cookies/localStorage/session).
 *
 * Caller is responsible for cleanup via `closeMultiPlayerPages()`.
 */
export async function createMultiPlayerPages(
  browser: Browser,
  count: number,
  baseURL: string,
): Promise<MultiPlayerContext> {
  const contexts: BrowserContext[] = [];
  const pages: GamePage[] = [];

  for (let i = 0; i < count; i++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    // Set baseURL behavior by navigating relative to it
    contexts.push(context);
    pages.push(new GamePage(page));
  }

  return { pages, contexts };
}

export async function closeMultiPlayerPages(mp: MultiPlayerContext): Promise<void> {
  for (const ctx of mp.contexts) {
    await ctx.close();
  }
}

export interface PhoneLayoutContractOptions {
  screenRootSelector: string;
  primaryRegionSelector: string;
  screenChromeSelector?: string;
  primaryHeaderSelector?: string;
  phoneGridSelector?: string;
  minPrimaryWidthRatio?: number;
}

export async function assertPhoneLayoutContract(
  gamePage: GamePage,
  options: PhoneLayoutContractOptions,
): Promise<void> {
  const metrics = await gamePage.page.locator(options.screenRootSelector).evaluate(
    (screen, contract) => {
      const primary = screen.querySelector(contract.primaryRegionSelector) as HTMLElement | null;
      const phoneGrids = [...screen.querySelectorAll(contract.phoneGridSelector)] as HTMLElement[];
      const screenRect = screen.getBoundingClientRect();
      const withinScreen = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= screenRect.left - 1 && rect.right <= screenRect.right + 1;
      };
      const columnCount = (grid: HTMLElement) =>
        getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;

      return {
        hasPrimaryRegion: Boolean(primary),
        hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        shellOwnsPrimaryHeader: screen.querySelector(contract.screenChromeSelector) !== null,
        duplicatePrimaryHeaderCount: primary?.querySelectorAll(contract.primaryHeaderSelector).length ?? 0,
        primaryWidthRatio: primary
          ? primary.getBoundingClientRect().width / Math.max(1, screenRect.width)
          : 0,
        primaryEscapesScreen: primary ? !withinScreen(primary) : false,
        phoneGridViolations: phoneGrids.flatMap((grid, index) => {
          const issues: string[] = [];
          const columns = columnCount(grid);
          const maxColumns = Number(grid.dataset.phoneGridMaxColumns || 2);
          if (columns <= 0) {
            issues.push(`grid-${index}:missing-columns`);
          } else if (columns > maxColumns) {
            issues.push(`grid-${index}:columns-${columns}-exceed-${maxColumns}`);
          }
          if (grid.scrollWidth > grid.clientWidth + 1) {
            issues.push(`grid-${index}:horizontal-overflow`);
          }
          if (!withinScreen(grid)) {
            issues.push(`grid-${index}:clipped`);
          }
          return issues;
        }),
      };
    },
    {
      primaryRegionSelector: options.primaryRegionSelector,
      screenChromeSelector: options.screenChromeSelector ?? '[data-screen-chrome="primary-header-owner"]',
      primaryHeaderSelector: options.primaryHeaderSelector ?? '[data-ui-skin-role="frame.header"]',
      phoneGridSelector: options.phoneGridSelector ?? '[data-phone-grid]',
    },
  );

  expect(metrics.hasPrimaryRegion, 'primary content region marker is missing').toBe(true);
  expect(metrics.hasHorizontalOverflow, 'screen overflows the phone viewport horizontally').toBe(false);
  expect(metrics.primaryEscapesScreen, 'primary content is clipped outside the screen bounds').toBe(false);
  expect(
    metrics.primaryWidthRatio,
    `primary content width ratio ${metrics.primaryWidthRatio.toFixed(2)} fell below the phone contract`,
  ).toBeGreaterThanOrEqual(options.minPrimaryWidthRatio ?? 0.72);
  if (metrics.shellOwnsPrimaryHeader) {
    expect(metrics.duplicatePrimaryHeaderCount, 'shell-owned screens must not render a second primary header inside content').toBe(0);
  }
  expect(metrics.phoneGridViolations, `phone grid contract violations: ${metrics.phoneGridViolations.join(', ')}`).toEqual([]);
}

// =============================================================================
// Polling helpers — cross-session state propagation
// =============================================================================

/**
 * Poll until a condition is met. Use for cross-session state propagation
 * where UI changes are async (room code appearing, turn indicator updating).
 */
export async function waitForCondition(
  page: GamePage,
  check: () => Promise<boolean> | boolean,
  timeoutMs = 15000,
  intervalMs = 500,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await page.wait(intervalMs);
  }
  throw new Error('waitForCondition: condition not met within timeout');
}

/**
 * Poll until a selector is visible on the page.
 */
export async function waitForVisible(
  page: GamePage,
  selector: string,
  timeoutMs = 15000,
): Promise<void> {
  await waitForCondition(
    page,
    async () => page.isVisible(selector),
    timeoutMs,
  );
}

/**
 * Read the room code from a GamePage via the UI element
 * `[data-testid="room-code"]`. The module install note requires games
 * to render the room code with this data-testid.
 *
 * Returns the room code string, or throws if not found within timeout.
 */
export async function waitForRoomCode(
  page: GamePage,
  timeoutMs = 20000,
): Promise<string> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const uiVisible = await page.isVisible('[data-testid="room-code"]');
    if (uiVisible) {
      const code = await page.getText('[data-testid="room-code"]');
      if (code && code.length > 0) return code;
    }

    await page.wait(1000);
  }

  throw new Error('waitForRoomCode: no [data-testid="room-code"] element found within timeout. Ensure the room code is rendered in the UI per the turn-based-rooms install note.');
}

/**
 * Standard two-player room setup. Player A creates a room, player B joins
 * by code. Both wait for the game to be ready.
 *
 * @param options.beforeCreate — optional per-game hook (e.g. dismiss FTUE, daily rewards)
 */
export async function setupTwoPlayerRoom(
  playerA: GamePage,
  playerB: GamePage,
  options?: {
    beforeCreate?: (page: GamePage) => Promise<void>;
  },
): Promise<{ roomCode: string }> {
  await playerA.goto('/');
  await playerB.goto('/');
  await playerA.wait(2000);
  await playerB.wait(2000);

  if (options?.beforeCreate) {
    await options.beforeCreate(playerA);
    await options.beforeCreate(playerB);
  }

  playerA.seedState('room.createRoom');

  const roomCode = await waitForRoomCode(playerA);

  playerB.seedState('room.joinByCode', roomCode);
  await playerB.wait(3000);

  // Host calls startGame. If server auto-started (409), silently ignored.
  playerA.seedState('room.startGame');
  await playerA.wait(2000);

  return { roomCode };
}

// =============================================================================
// Orientation testing
// =============================================================================

export type TestOrientation = 'portrait' | 'landscape';

const VIEWPORTS: Record<TestOrientation, { width: number; height: number }> = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};

function withOrientationQuery(path: string, orientation: TestOrientation): string {
  const [pathnameWithSearch, hash = ''] = path.split('#', 2);
  const [pathname, search = ''] = pathnameWithSearch.split('?', 2);
  const params = new URLSearchParams(search);
  params.set('orientation', orientation);
  const nextSearch = params.toString();
  const nextPath = nextSearch.length > 0 ? `${pathname}?${nextSearch}` : pathname;
  return hash.length > 0 ? `${nextPath}#${hash}` : nextPath;
}

export async function testBothOrientations(
  gamePage: GamePage,
  run: (orientation: TestOrientation) => Promise<void>,
  options: { path?: string; orientations?: readonly TestOrientation[] } = {},
): Promise<void> {
  const path = options.path ?? '/';
  const orientations = options.orientations ?? (['portrait', 'landscape'] as const);

  for (const orientation of orientations) {
    const viewport = VIEWPORTS[orientation];
    await gamePage.page.setViewportSize(viewport);
    await gamePage.goto(withOrientationQuery(path, orientation));
    await run(orientation);
  }
}
