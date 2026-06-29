/**
 * Standalone QA Tester
 *
 * Runs smoke tests without a test framework using Playwright.
 *
 * Usage:
 *   npx tsx e2e/qa-tester.ts             # headless
 *   npx tsx e2e/qa-tester.ts --headed    # visible browser
 *   JSON_OUTPUT=true npx tsx e2e/qa-tester.ts  # JSON for CI
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { resolveLocalDevBaseUrl } from '../dev-server.config';

const headed = process.argv.includes('--headed');
const BASE_URL = resolveLocalDevBaseUrl();

/**
 * Chromium launch args to enable WebGL/WebGPU in headless mode.
 * SwiftShader provides a software GL backend so tests work without a GPU.
 */
const BROWSER_ARGS = [
  '--enable-webgl',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-unsafe-webgpu',
];

// =============================================================================
// TYPES
// =============================================================================

interface QAIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  screenshot?: string;
}

interface QAResult {
  passed: boolean;
  issues: QAIssue[];
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  consoleErrors: string[];
  duration: number;
}

// =============================================================================
// QA TESTER
// =============================================================================

class QATester {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private issues: QAIssue[] = [];
  private consoleErrors: string[] = [];
  private pageErrors: string[] = [];
  private testsRun = 0;
  private testsPassed = 0;
  private testsFailed = 0;
  private screenshotDir = 'e2e/qa-screenshots';

  async setup(): Promise<void> {
    console.log(`\nStarting QA Tester (Playwright, ${headed ? 'headed' : 'headless'})...`);
    this.browser = await chromium.launch({ headless: !headed, args: BROWSER_ARGS });
    this.context = await this.browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    this.page = await this.context.newPage();

    this.page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!/favicon|net::ERR|404|WebGL.*GPU stall/i.test(text)) {
          this.consoleErrors.push(text);
        }
      }
    });
    this.page.on('pageerror', (error) => {
      this.pageErrors.push(String(error));
    });

    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await this.page.waitForFunction(
      () => {
        const hasDom =
          document.querySelector('canvas') !== null ||
          document.querySelector('#root > *') !== null;
        const hasDebugApi =
          typeof (window as any).__GAME_DEBUG__ !== 'undefined' &&
          typeof (window as any).__GAME_DEBUG__?.ui !== 'undefined';
        return hasDom && hasDebugApi;
      },
      { timeout: 30_000 },
    );
    await this.page.waitForTimeout(1000);
  }

  async teardown(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
  }

  private async screenshot(name: string): Promise<string> {
    if (!this.page) return '';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = `${this.screenshotDir}/${name}-${ts}.png`;
    try {
      await this.page.screenshot({ path: filepath });
      return filepath;
    } catch {
      return '';
    }
  }

  private addIssue(issue: QAIssue): void {
    this.issues.push(issue);
    const icon = issue.severity === 'error' ? '[FAIL]' : issue.severity === 'warning' ? '[WARN]' : '[INFO]';
    console.log(`   ${icon} [${issue.category}] ${issue.message}`);
  }

  private async test(name: string, testFn: () => Promise<void>): Promise<void> {
    this.testsRun++;
    console.log(`\nTesting: ${name}`);
    try {
      await testFn();
      this.testsPassed++;
      console.log('   [PASS]');
    } catch (error) {
      this.testsFailed++;
      const message = error instanceof Error ? error.message : String(error);
      const screenshotPath = await this.screenshot(name.replace(/\s+/g, '-').toLowerCase());
      this.addIssue({ severity: 'error', category: 'Test Failure', message: `${name}: ${message}`, screenshot: screenshotPath || undefined });
    }
  }

  async runAll(): Promise<QAResult> {
    const startTime = Date.now();
    try {
      await this.setup();
      await this.screenshot('initial-state');
      await this.testAppLoads();
      await this.testNoConsoleErrors();
      await this.testDebugApi();
      await this.testCoreLoopReachable();
      await this.screenshot('final-state');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.addIssue({ severity: 'error', category: 'Setup', message: `QA setup failed: ${message}` });
    } finally {
      await this.teardown();
    }

    return {
      passed: this.testsFailed === 0 && this.issues.filter((i) => i.severity === 'error').length === 0,
      issues: this.issues,
      testsRun: this.testsRun,
      testsPassed: this.testsPassed,
      testsFailed: this.testsFailed,
      consoleErrors: [...this.consoleErrors, ...this.pageErrors],
      duration: Date.now() - startTime,
    };
  }

  private async testAppLoads(): Promise<void> {
    await this.test('App renders without crashing', async () => {
      const snapshot = await this.page!.locator('body').ariaSnapshot();
      if (!snapshot || snapshot.length < 50) {
        throw new Error('App did not render — snapshot too short');
      }
    });
  }

  private async testNoConsoleErrors(): Promise<void> {
    await this.test('No critical console errors', async () => {
      const allErrors = [...this.consoleErrors, ...this.pageErrors];
      if (allErrors.length > 0) {
        throw new Error(`${allErrors.length} console error(s):\n${allErrors.slice(0, 5).join('\n')}`);
      }
    });
  }

  private async testDebugApi(): Promise<void> {
    await this.test('Debug API accessible', async () => {
      const hasDebugApi = await this.page!.evaluate(
        () => typeof (window as any).__GAME_DEBUG__ !== 'undefined',
      );
      if (!hasDebugApi) {
        this.addIssue({
          severity: 'warning',
          category: 'Debug API',
          message: 'window.__GAME_DEBUG__ not found — smoke tests will be limited',
        });
      }
    });
  }

  private async testCoreLoopReachable(): Promise<void> {
    await this.test('App renders interactive content', async () => {
      // Wait for initial render to settle
      await this.page!.waitForTimeout(2000);

      // Check for any interactive element: buttons, links, clickable cards
      const interactiveSelectors = [
        this.page!.getByRole('button'),
        this.page!.getByRole('link'),
        this.page!.getByRole('tab'),
        this.page!.locator('[role="button"]'),
        this.page!.locator('[data-skin-role]'),
        this.page!.locator('a[href]'),
      ];

      let foundInteractive = false;
      for (const locator of interactiveSelectors) {
        if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
          foundInteractive = true;
          break;
        }
      }

      if (!foundInteractive) {
        throw new Error(
          'No interactive elements found after load (no buttons, links, or clickable cards). ' +
          'The app may not be rendering its UI.',
        );
      }

      await this.screenshot('interactive-content');

      const hasContent = await this.page!.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          try {
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (gl) {
              const w = canvas.width, h = canvas.height;
              const samples = [[w / 2, h / 2], [w / 4, h / 4], [3 * w / 4, 3 * h / 4], [w / 2, h / 4]];
              const colors = new Set<string>();
              const px = new Uint8Array(4);
              for (const s of samples) {
                gl.readPixels(Math.floor(s[0]), Math.floor(s[1]), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
                colors.add(`${px[0]},${px[1]},${px[2]}`);
              }
              return colors.size > 1;
            }
          } catch { /* fall through */ }
        }
        const gameplay = document.querySelector('[data-testid="gameplay"]') ||
          document.querySelector('[data-screen="gameplay"]') ||
          document.querySelector('main');
        if (gameplay) return gameplay.children.length > 2;
        return document.body.innerText.length > 100;
      });

      if (!hasContent) {
        throw new Error(
          'Gameplay viewport appears blank. ' +
          'The game may be missing its startup/init sequence (terrain generation, player spawn, etc.).',
        );
      }

      const r3fCheck = await this.page!.evaluate(() => {
        const canvas = document.querySelector('canvas') as any;
        if (!canvas) return { hasCanvas: false, r3fAttached: false };
        return { hasCanvas: true, r3fAttached: !!canvas.__r3f };
      });

      if (r3fCheck?.hasCanvas && !r3fCheck.r3fAttached) {
        this.addIssue({
          severity: 'warning',
          category: 'Core Loop',
          message: 'R3F Canvas element exists but fiber store (__r3f) is not attached. Three.js scene may not be rendering.',
        });
      }
    });
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  const tester = new QATester();
  const result = await tester.runAll();

  console.log('\n' + '='.repeat(60));
  console.log('QA TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Tests: ${result.testsPassed}/${result.testsRun} passed`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);

  if (result.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '[FAIL]' : '[WARN]';
      console.log(`  ${icon} [${issue.category}] ${issue.message}`);
      if (issue.screenshot) console.log(`     Screenshot: ${issue.screenshot}`);
    }
  }

  if (result.consoleErrors.length > 0) {
    console.log(`\nConsole Errors (${result.consoleErrors.length}):`);
    for (const error of result.consoleErrors.slice(0, 10)) {
      console.log(`  - ${error.slice(0, 120)}`);
    }
  }

  if (process.env.JSON_OUTPUT === 'true') {
    console.log('\nJSON Output:');
    console.log(JSON.stringify(result, null, 2));
  }

  process.exit(result.passed ? 0 : 1);
}

main().catch((err) => {
  console.error('QA Tester crashed:', err);
  process.exit(1);
});
