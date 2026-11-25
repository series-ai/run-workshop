import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:58392",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:58392/?testMode=1",
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
