import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'dev-multiplayer.spec.ts',
  outputDir: './test-results/dev-multiplayer/e2e',
  workers: 1,
  preserveOutput: 'always',
  use: {
    baseURL: 'http://127.0.0.1:4497',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    viewport: { width: 960, height: 640 },
    headless: true,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4497 --strictPort',
    env: { WRECK_YARD_ROOM_PORT: '4498', SYNCPLAY_SOURCE_OVERRIDE: '' },
    url: 'http://127.0.0.1:4497',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
