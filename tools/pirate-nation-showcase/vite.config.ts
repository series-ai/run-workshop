import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ports are pinned so sub-projects never collide: picmon-editor owns
// 5180/4180, this app owns 5190/4190.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // R3F hooks crash if two `three` or `react` copies load; dedupe is the
    // safety net (same convention as tools/3d-pfx-library).
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },
  server: {
    port: 5190,
    strictPort: true,
  },
  preview: {
    port: 4190,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Node by default: the catalog and avatar-composition tests are pure
    // logic and need no DOM.
    environment: 'node',
  },
})
