import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

// Set RC55_GAME_DIR to the isolated rc55 game checkout. Keep the main dependency unchanged.
const gameDir = process.env.RC55_GAME_DIR ?? process.cwd();

export default defineConfig({
  testDir: join(gameDir, 'e2e'),
  testMatch: 'rc55-stress.spec.ts',
  outputDir: './test-results/rc55-stress/browser/e2e',
  preserveOutput: 'always', workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:4517', headless: true },
  projects: [
    { name: 'chrome', grepInvert: /WebKit/, use: { browserName: 'chromium', channel: 'chrome',
      viewport: { width: 960, height: 640 }, launchOptions: {
        args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--no-sandbox'],
      } } },
    { name: 'webkit-smoke', grep: /WebKit/, use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4517 --strictPort',
    cwd: gameDir,
    env: { WRECK_YARD_ROOM_PORT: '4518', SYNCPLAY_SOURCE_OVERRIDE: '' },
    url: 'http://127.0.0.1:4517', reuseExistingServer: !process.env.CI, timeout: 60_000,
  },
});
