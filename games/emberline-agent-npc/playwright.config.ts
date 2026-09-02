import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:5183',
        viewport: { width: 390, height: 844 },
    },
    webServer: {
        command: 'vite --mode offline --host 127.0.0.1',
        url: 'http://127.0.0.1:5183',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
    },
});
