import { defineConfig } from '@playwright/test';

const externalUrl = process.env.WRECK_E2E_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results/e2e',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  preserveOutput: 'always',
  use: {
    baseURL: externalUrl ?? 'http://127.0.0.1:4710',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    viewport: { width: 1100, height: 720 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.platform === 'darwin'
      ? { args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl'] }
      : {},
  },
  webServer: externalUrl ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4710 --strictPort',
    env: { WRECK_YARD_ROOM_PORT: '4711' },
    url: 'http://127.0.0.1:4710',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
