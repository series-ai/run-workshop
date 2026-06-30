import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { resolveDevBindHost, resolveDevPort } from './dev-server.config';
import { resolvePlaywrightRuntime } from './e2e/playwright/runtime';

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

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const DEV_PORT = resolveDevPort(rootDir);
const DEV_HOST = resolveDevBindHost();
const PLAYWRIGHT_SANDBOX_GAME_ID = 'local-template-debug';

const runtime = resolvePlaywrightRuntime({
  projectDir: rootDir,
  devCommand: `RUNDOT_SANDBOX_GAME_ID=${PLAYWRIGHT_SANDBOX_GAME_ID} node --import tsx e2e/playwright/run-dev-with-module-fixture.ts --host ${DEV_HOST} --port ${DEV_PORT}`,
  // Reuse a dev server already bound to DEV_PORT when running locally. CI
  // always spawns its own. This prevents `test:e2e` from dying with
  // "address already in use" when a long-running dev server
  // (browser-verify, manual dev) is still attached to the port.
  reuseExistingDevServer: !process.env.CI,
});

function resolveDevice(deviceName: string) {
  return devices[deviceName] ?? devices['iPhone 13'];
}

function resolveReporters() {
  if (process.env.PLAYWRIGHT_BLOB_REPORT === '1') {
    return [['list'], ['blob', { outputDir: 'blob-report' }]] as const;
  }

  return [['list'], ['json', { outputFile: 'e2e/playwright/test-results.json' }]] as const;
}

export default defineConfig({
  testDir: './e2e/playwright',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  maxFailures: 3,
  retries: 0,
  reporter: resolveReporters(),
  grep: runtime.grep,
  grepInvert: runtime.grepInvert,
  use: {
    baseURL: runtime.baseURL,
    headless: !process.env.HEADED,
    video: runtime.videoMode,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: runtime.projects.map((project) => ({
    name: project.name,
    grep: project.grep,
    use: {
      ...resolveDevice(project.deviceName),
      launchOptions: project.deviceName.includes('Chrome') ? { args: BROWSER_ARGS } : undefined,
      video: project.videoMode ?? runtime.videoMode,
    },
  })),
  webServer: runtime.webServer
    ? {
        command: runtime.webServer.command,
        url: runtime.baseURL,
        reuseExistingServer: runtime.webServer.reuseExistingServer,
        gracefulShutdown: {
          signal: 'SIGTERM',
          timeout: 5_000,
        },
        timeout: 60_000,
      }
    : undefined,
});
