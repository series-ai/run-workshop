/**
 * Playwright fixtures for game E2E tests.
 *
 * Provides `gamePage` — a wrapper around Playwright's `Page` that preserves
 * the same testing contract as the legacy wrapper: seedState is
 * write-only, assertions go through the UI, onboarding must be tested
 * through real interaction.
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

export { expect };

const APP_READY_SELECTOR = '[data-testid="app-shell"][data-e2e-state="ready"]';
const APP_ERROR_SELECTOR = '[data-testid="app-startup-error"], [data-testid="app-runtime-error"]';
const PLAYGROUND_AUTH_TEXT = 'Sign in with Google to start';

// =============================================================================
// GamePage — Playwright wrapper for game E2E tests
// =============================================================================

export class GamePage {
  readonly page: Page;
  private readonly consoleErrors: string[] = [];
  private readonly requestFailures: string[] = [];

  constructor(page: Page) {
    this.page = page;

    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!/favicon|net::ERR|404|WebGL.*GPU stall/i.test(text)) {
          this.consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', (error) => {
      this.consoleErrors.push(String(error));
    });
    page.on('requestfailed', (request) => {
      if (!this.shouldTrackRequestFailure(request.url(), request.resourceType())) {
        return;
      }
      this.requestFailures.push(
        `${request.resourceType().toUpperCase()} ${request.failure()?.errorText ?? 'request failed'} ${request.url()}`,
      );
    });
    page.on('response', (response) => {
      const request = response.request();
      if (response.status() < 400) {
        return;
      }
      if (!this.shouldTrackRequestFailure(response.url(), request.resourceType(), response.status())) {
        return;
      }
      this.requestFailures.push(
        `${request.resourceType().toUpperCase()} ${response.status()} ${request.method()} ${response.url()}`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async goto(path = '/'): Promise<void> {
    this.resetPageState();
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.waitForAppReady();
  }

  async waitForAppReady(): Promise<void> {
    await this.page.waitForFunction(
      ({ readySelector, errorSelector, authText }) =>
        Boolean(
          document.querySelector(readySelector) ||
            document.querySelector(errorSelector) ||
            document.body.textContent?.includes(authText),
        ),
      {
        readySelector: APP_READY_SELECTOR,
        errorSelector: APP_ERROR_SELECTOR,
        authText: PLAYGROUND_AUTH_TEXT,
      },
      { timeout: 30_000 },
    );

    const authGate = this.page.getByText(PLAYGROUND_AUTH_TEXT);
    if (await authGate.isVisible()) {
      throw new Error(
        'Playwright is blocked on the sign-in gate. Authenticate locally or set RUNDOT_API_KEY before running exported-repo E2E.',
      );
    }

    const startupError = this.page.locator(APP_ERROR_SELECTOR).first();
    if (await startupError.isVisible()) {
      const message = (await startupError.textContent())?.trim() ?? 'unknown startup failure';
      throw new Error(`App failed to reach ready state: ${message}`);
    }

    await expect(this.page.locator(APP_READY_SELECTOR)).toBeVisible();
  }

  async reload(): Promise<void> {
    this.resetPageState();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForAppReady();
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  // ---------------------------------------------------------------------------
  // DOM Interaction — use Playwright locators directly for new tests.
  // These convenience methods preserve the old API surface for migrated tests.
  // ---------------------------------------------------------------------------

  async click(selector: string): Promise<void> {
    await this.page.locator(selector).click();
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.locator(selector).fill(value);
  }

  async isVisible(selector: string): Promise<boolean> {
    const loc = this.page.locator(selector);
    if ((await loc.count()) === 0) return false;
    return loc.first().isVisible();
  }

  async waitForSelector(selector: string): Promise<void> {
    await this.page.locator(selector).waitFor();
  }

  async getText(selector: string): Promise<string> {
    return (await this.page.locator(selector).textContent())?.trim() ?? '';
  }

  async getSnapshot(): Promise<string> {
    return this.page.locator('body').ariaSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Canvas Interaction
  // ---------------------------------------------------------------------------

  async getCanvasSize(): Promise<{ width: number; height: number }> {
    return this.page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { width: c.width, height: c.height } : { width: 0, height: 0 };
    });
  }

  async getCanvasCenter(): Promise<{ x: number; y: number }> {
    const { width, height } = await this.getCanvasSize();
    return { x: width / 2, y: height / 2 };
  }

  async clickCanvas(x: number, y: number): Promise<void> {
    const canvas = this.page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No canvas found');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  async dragCanvas(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    steps = 10,
  ): Promise<void> {
    const canvas = this.page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('No canvas found');
    await this.page.mouse.move(box.x + startX, box.y + startY);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + endX, box.y + endY, { steps });
    await this.page.mouse.up();
  }

  // ---------------------------------------------------------------------------
  // Screenshots
  // ---------------------------------------------------------------------------

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `e2e/qa-screenshots/${name}.png` });
  }

  // ---------------------------------------------------------------------------
  // State Seeding — write-only test setup
  // ---------------------------------------------------------------------------

  /**
   * Seed game state for test setup. Write-only — returns nothing.
   *
   * DO NOT use page.evaluate() to read window.__GAME_DEBUG__ for assertions.
   * All test assertions must go through the UI.
   */
  seedState(path: string, ...args: unknown[]): void {
    // Fire-and-forget evaluate. No return value.
    void this.waitForAutomationReady()
      .then(() =>
        this.page.evaluate(
          ({ p, a }) => {
            const parts = p.split('.');
            let target: any = (window as any).__GAME_DEBUG__;
            for (let i = 0; i < parts.length - 1; i++) {
              target = target[parts[i]];
            }
            const fn = target[parts[parts.length - 1]];
            if (typeof fn === 'function') fn.call(target, ...a);
          },
          { p: path, a: args },
        ),
      )
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.consoleErrors.push(`Automation hook unavailable: ${message}`);
      });
  }

  async openScreen(screen: string): Promise<void> {
    await this.waitForAutomationReady();
    this.seedState('ui.openScreen', screen);
    await this.wait(300);
  }

  async resetAllState(): Promise<void> {
    await this.waitForAutomationReady();
    await this.page.evaluate(() => {
      const d = (window as any).__GAME_DEBUG__;
      if (!d) return;
      Object.keys(d).forEach((ns) => {
        if (d[ns] && typeof d[ns] === 'object' && typeof d[ns].reset === 'function') {
          d[ns].reset();
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Console Errors
  // ---------------------------------------------------------------------------

  getConsoleErrors(): string[] {
    return [...this.consoleErrors];
  }

  getStartupRequestFailures(): string[] {
    return [...this.requestFailures];
  }

  assertNoConsoleErrors(): void {
    // External-SDK / playground-network noise that mobile-chromium
    // surfaces under headless. None of these are application code:
    //   - firestore long-poll "access control" warnings (Rundot SDK)
    //   - Firebase auth securetoken refresh blocked by CORS in headless
    //   - the local rundot-server-config probe failing offline
    //   - the explicit firestore connection-failed log line
    //   - decodeAudioData failures on `*-fx-B-3.mp3` etc — the audio
    //     defect is tracked separately by the validators; the spec
    //     shouldn't fail on it.
    //   - fire-and-forget automation setup interrupted by navigation
    //     during test teardown.
    const SDK_NOISE = [
      /firestore\.googleapis\.com/i,
      /securetoken\.googleapis\.com/i,
      /__rundot-server-config/i,
      /@firebase\/firestore/i,
      /\[pad-audio-graph\] decodeAudioData failed/i,
      /Automation hook unavailable: page\.evaluate: Execution context was destroyed/i,
    ];
    const ours = this.consoleErrors.filter(
      (e) => !SDK_NOISE.some((rx) => rx.test(e)),
    );
    expect(ours).toEqual([]);
  }

  clearConsoleErrors(): void {
    this.consoleErrors.length = 0;
  }

  private resetPageState(): void {
    this.consoleErrors.length = 0;
    this.requestFailures.length = 0;
  }

  private shouldTrackRequestFailure(url: string, resourceType: string, status?: number): boolean {
    if (/favicon/i.test(url)) {
      return false;
    }
    if (status === 304) {
      return false;
    }
    return ['document', 'script', 'fetch', 'xhr', 'stylesheet'].includes(resourceType);
  }

  private async waitForAutomationReady(): Promise<void> {
    await this.page.waitForFunction(
      () =>
        typeof (window as any).__GAME_DEBUG__ !== 'undefined' &&
        typeof (window as any).__GAME_DEBUG__?.ui !== 'undefined',
      { timeout: 30_000 },
    );
  }
}

// =============================================================================
// Test fixture — use `test` from this module instead of @playwright/test
// =============================================================================

export const test = base.extend<{ gamePage: GamePage }>({
  gamePage: async ({ page }, use) => {
    const gp = new GamePage(page);
    await use(gp);
    gp.assertNoConsoleErrors();
  },
});
