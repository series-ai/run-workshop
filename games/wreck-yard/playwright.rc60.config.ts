import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const auditDir = resolve(process.env.RC60_AUDIT_DIR ?? resolve(import.meta.dirname, 'test-results/rc60-validation/browser'));

export default defineConfig({
  testDir: './e2e',
  testMatch: ['dev-multiplayer.spec.ts', 'rc60-stress.spec.ts'],
  outputDir: resolve(auditDir, 'run-1'),
  preserveOutput: 'always', workers: 1, retries: 0,
  reporter: [['line'], ['json', { outputFile: resolve(auditDir, 'run-1.json') }]],
  use: { baseURL: 'http://127.0.0.1:4577', headless: true },
  projects: [
    { name: 'chrome', grepInvert: /WebKit|short reverse/, use: { browserName: 'chromium', channel: 'chrome',
      viewport: { width: 960, height: 640 }, launchOptions: {
        args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--no-sandbox'],
      } } },
    { name: 'webkit-smoke', testMatch: 'rc60-stress.spec.ts', grep: /WebKit/, use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4577 --strictPort',
    cwd: import.meta.dirname,
    env: { WRECK_YARD_ROOM_PORT: '4578', SYNCPLAY_SOURCE_OVERRIDE: '' },
    url: 'http://127.0.0.1:4577', reuseExistingServer: false, timeout: 60_000,
  },
});
