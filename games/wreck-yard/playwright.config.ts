import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4398', headless: true },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4398',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
