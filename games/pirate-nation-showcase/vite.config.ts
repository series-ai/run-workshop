import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

// Ports are pinned so sub-projects never collide: picmon-editor owns
// 5180/4180, this app owns 5190/4190.
//
// `rundotGameSandboxPlugin` is intentionally absent: it backs storage,
// profile, and leaderboard calls in local dev, and this app calls none of
// them. Skipping it keeps `npm run dev` and the e2e suite free of any
// RUNDOT_API_KEY requirement.
export default defineConfig(() => {
  return {
    plugins: [
      react(), // Must come first — handles the JSX transform
      rundotGameLibrariesPlugin(),
    ],
    base: './',
    resolve: {
      // R3F hooks crash if two `three` or `react` copies load; dedupe is the
      // safety net (same convention as tools/3d-pfx-library).
      dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
    },
    // The RUN SDK ships top-level await, so both the transform and the dev
    // pre-bundle need an es2022 target.
    esbuild: { target: 'es2022' },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    server: { port: 5190, strictPort: true },
    preview: { port: 4190, strictPort: true },
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      // Node by default: the catalog and avatar-composition tests are pure
      // logic and need no DOM.
      environment: 'node',
    },
  }
})
