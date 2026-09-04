import { defineConfig } from 'vitest/config'

// Pure-logic tests only: the canvas painters and R3F components are verified
// visually in games/clubhouse-demo (node/jsdom have no real 2D canvas).
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
