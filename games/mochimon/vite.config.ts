import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

// The character model (src/model/) is also run under node by build scripts, so its few node imports are stubbed out
// for the browser.
const model = new URL('./src/model/', import.meta.url).pathname
export default {
  // RUN serves builds from a subdirectory: asset URLs must stay relative
  base: './',
  plugins: [rundotGameLibrariesPlugin()],
  resolve: { alias: {
    'node:zlib': model + 'zlib-stub.ts',
    ...Object.fromEntries(['node:fs', 'node:child_process', 'node:path', 'node:url'].map((m) => [m, model + 'node-stub.ts'])),
  } },
  optimizeDeps: { exclude: ['@series-inc/rundot-game-sdk'], esbuildOptions: { target: 'es2022' } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
}
