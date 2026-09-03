import { defineConfig } from 'vitest/config';

// The dither-core tests moved to tools/dither-kit; keep this config so
// future playground tests slot in without failing on an empty suite.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], passWithNoTests: true },
});
