import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5190',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5190',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
