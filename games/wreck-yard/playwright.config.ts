import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  preserveOutput: 'always',
  use: {
    baseURL: 'http://127.0.0.1:4398',
    headless: true,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4398',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
