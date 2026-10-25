import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@series-inc/rundot-game-sdk/api': `${root}__mocks__/rundot-api.ts`,
    },
  },
  test: {
    environment: 'node',
    maxWorkers: 1,
    setupFiles: ['src/deterministicMath.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 300_000,
  },
});
