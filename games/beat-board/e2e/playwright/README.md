# Playwright E2E Testing

Browser testing via Playwright. Local runs default to the Vite dev server for convenience; CI and release lanes run the built `dist/` artifact or an explicit remote `BASE_URL`. Tests interact with the game through DOM locators, canvas events, and state seeding (`seedState`).

## Quick Start

```bash
npx playwright install --with-deps  # first run on a new machine
npm run test:e2e             # local full suite against the dev server
npm run test:e2e:smoke       # smoke-only filter
npm run test:e2e:ci          # build + built-artifact suite
npm run test:e2e:walkthrough # build + walkthrough project with always-on video
npm run test:e2e:headed      # local full suite with visible browser
npm run qa                   # standalone headless smoke test
npm run qa:headed            # same but with visible browser
```

You can also point Playwright at an existing URL:

```bash
BASE_URL=https://example.com PLAYWRIGHT_TEST_FILTER=smoke npx playwright test
```

## Test Taxonomy

- `@smoke` — minimal remote-safe startup and primary-action coverage
- `@mobile` — mobile-only interaction checks
- `@desktop` — desktop-only interaction checks
- `@responsive` — viewport/orientation behavior
- `@walkthrough` — deterministic startup-plus-primary-action recording lane
- `@triage` — draft repro tests generated for investigation

Draft triage specs live in `e2e/playwright/triage/`. The baseline walkthrough flow lives in `e2e/playwright/walkthrough-contract.ts` and is the intended extension point for repo-specific recorded journeys.

## Test Lifecycle — `gamePage` fixture

Every test file should use the `gamePage` fixture from `fixtures.ts`:

```typescript
import { test, expect } from './fixtures';

test.describe('My feature', () => {
  test('does something', async ({ gamePage }) => {
    await gamePage.goto('/');
    // ...
  });
});
```

The fixture creates a fresh page per test, tracks console errors, and asserts no errors on teardown.

## Navigation

```typescript
await gamePage.goto('/');                          // open URL, wait for app ready
await gamePage.reload();                           // reload page, wait for ready
await gamePage.wait(500);                          // wait N ms
await gamePage.waitForSelector('.my-btn');          // wait for DOM element
```

`waitForAppReady()` now waits for the template's visible ready or error contract. It fails fast if the app is blocked on the Playground sign-in gate and still does NOT auto-skip FTUE.

When `BASE_URL` points at a remote preview or production URL, only the `smoke`
and `walkthrough` filters are allowed. Local-only suites such as debug-console,
performance-overlay, and any tests that mutate state through `seedState()` are
blocked up front.

## Canvas Interaction

R3F games render to `<canvas>`. Use these methods for gameplay interactions:

```typescript
const { width, height } = await gamePage.getCanvasSize();
const { x, y } = await gamePage.getCanvasCenter();

await gamePage.clickCanvas(100, 200);              // click at canvas-relative coords
await gamePage.dragCanvas(100, 200, 300, 200);     // drag from start to end
await gamePage.dragCanvas(100, 200, 300, 200, 20); // drag with custom step count
```

## Direct Playwright Access

For advanced interactions, use `gamePage.page` to access the underlying Playwright `Page`:

```typescript
await gamePage.page.getByRole('button', { name: 'Play' }).click();
await gamePage.page.getByText('Score: 100').waitFor();
const snapshot = await gamePage.page.locator('#game').ariaSnapshot();
```

Prefer Playwright locators (`getByRole`, `getByText`, `getByTestId`) over CSS selectors.

Primary CTA smoke checks should not rely only on `getByRole(..., { name })`.
Semantic UI buttons may style labels with CSS `text-transform` or render text
through nested spans, so fallback probes should also check
`[data-skin-role="button.primary"]`, `[data-testid*="play"]`, and visible
`button` / `[role="button"]` text matches.

## State Seeding — `seedState()`

`seedState()` is a **write-only** method for test setup. It calls `window.__GAME_DEBUG__` methods but returns nothing — you cannot use it to read game state.

```typescript
gamePage.seedState('currency.addCoins', 100);
gamePage.seedState('game.createTestGame', 'smoke-room');
await gamePage.openScreen('shop');
await gamePage.resetAllState();
```

All assertions must go through the UI: `getText()`, `isVisible()`, `getSnapshot()`, `waitForSelector()`, or direct Playwright locator assertions.

Local-only automation hooks such as `seedState()` still wait for `window.__GAME_DEBUG__` behind the fixture, but smoke and walkthrough assertions should use only visible UI plus observable request/console behavior.

## Retry for Flaky Tests

```typescript
import { test } from './fixtures';
import { withRetry } from './test-utils';

test('renders after animation', async ({ gamePage }) => {
  await gamePage.goto('/');
  await withRetry(async () => {
    const snapshot = await gamePage.getSnapshot();
    expect(snapshot).toContain('Game Board');
  });
});
```

## Multiplayer Testing

For games with async multiplayer, create multiple isolated browser contexts:

```typescript
import { test, expect } from './fixtures';
import { createMultiPlayerPages, closeMultiPlayerPages } from './test-utils';
import { resolveLocalDevBaseUrl } from '../../dev-server.config';

test('two players complete a turn', async ({ browser }) => {
  const mp = await createMultiPlayerPages(browser, 2, resolveLocalDevBaseUrl());
  try {
    const [playerA, playerB] = mp.pages;
    await playerA.goto('/');
    await playerA.click('[aria-label="New Game"]');
    const roomCode = await playerA.getText('[data-testid="room-code"]');
    await playerB.goto(`/?roomCode=${roomCode}`);
    // ...
  } finally {
    await closeMultiPlayerPages(mp);
  }
});
```

## Orientation Testing

```typescript
import { test } from './fixtures';
import { testBothOrientations } from './test-utils';

test('renders in both orientations', async ({ gamePage }) => {
  await testBothOrientations(gamePage, async (orientation) => {
    const snapshot = await gamePage.getSnapshot();
    expect(snapshot).toContain('Game');
  });
});
```

## Screenshots

```typescript
await gamePage.takeScreenshot('home-screen');
// Saved to e2e/qa-screenshots/home-screen.png
```

## CLI Debugging

```bash
# Run a single test with visible browser
npx playwright test e2e/playwright/my-test.spec.ts --headed

# Or use the headed script
npm run test:e2e:headed
```
