import { defineConfig } from 'vite'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

// `rundotGamePlaygroundPlugin` is intentionally omitted: this showcase uses
// zero cloud storage, leaderboards, or multiplayer, keeping `npm run dev` and
// Playwright CI free of any `RUNDOT_API_KEY` or `firebase` dependency.
export default defineConfig(() => {
  return {
    plugins: [rundotGameLibrariesPlugin()],
    base: './',
    resolve: {
      dedupe: ['three'],
    },
    // The RUN SDK ships top-level await, so both the transform and the dev
    // pre-bundle need an es2022 target.
    esbuild: { target: 'es2022' },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    server: { port: 5200, strictPort: true, allowedHosts: true },
    preview: { port: 4200, strictPort: true },
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: true,
    },
  }
})
