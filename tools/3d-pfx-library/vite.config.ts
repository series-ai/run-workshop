import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// One project, one node_modules: the library lives in ./src and the viewer app
// in ./viewer. `@pfx` is the library's public entry. `dedupe` is kept as a
// safety net so react/three resolve to a single instance (R3F hooks crash if
// two `three` copies load).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@pfx': path.resolve(rootDir, 'src'),
    },
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'viewer/src/**/*.test.{ts,tsx}'],
    // Default to node: profiling.ts branches on the presence of `document`
    // (device/browser detection), so jsdom perturbs its readiness logic.
    // The library catalog test opts into jsdom via a `@vitest-environment`
    // docblock (it needs a DOM for texture generation).
    environment: 'node',
  },
})
