import { defineConfig } from 'vitest/config'

// Unit tests run everywhere. `*.integration.test.ts` read built packs from
// out/jam-stage and the PN pack; run them with `npm run test:integration`.
export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'out/**', ...(process.env.RVX_INTEGRATION ? [] : ['**/*.integration.test.ts'])],
    include: process.env.RVX_INTEGRATION ? ['**/*.integration.test.ts'] : ['**/*.test.ts'],
  },
})
