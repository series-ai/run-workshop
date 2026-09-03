import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from '@series-inc/rundot-game-sdk/vite';
import { resolveSandboxGameId } from './sandbox.config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Env is scoped to this game's root only. Each workshop game owns its own
// `.env` / `.env.example`; we never walk up into a parent monorepo.
const envDir = rootDir;

export default defineConfig(() => {
  return {
    plugins: [
      react(), // Must come first - handles JSX transform
      rundotGameLibrariesPlugin(),
      rundotGamePlaygroundPlugin({
        // Falls back to auto-detection when no game.config.*.json exists yet.
        gameId: resolveSandboxGameId(rootDir),
        // No apiKey here on purpose: the plugin resolves RUNDOT_PLAYGROUND_KEY
        // from .env.local itself (minted by `rundot playground grant-access`).
        // It never reads RUNDOT_API_KEY.
      }),
    ],
    base: './',
    envDir,
    resolve: {
      alias: {
        '@clubhouse': fileURLToPath(new URL('../../tools/clubhouse-games/src/index.ts', import.meta.url)),
      },
      // R3F breaks with two copies of three/react in the graph.
      dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
    },
    // The shared library lives outside this app's root.
    server: { port: 4319, strictPort: true, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } },
    // RUN.game SDK includes top-level await, so target an environment that supports it.
    esbuild: { target: 'es2022' },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    build: { target: 'es2022' },
  };
});
