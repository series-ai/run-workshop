import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5197', viewport: { width: 1440, height: 1000 }, headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5197', reuseExistingServer: true },
  reporter: [['list'], ['json', { outputFile: 'docs/verification/browser-tests.json' }]],
})
