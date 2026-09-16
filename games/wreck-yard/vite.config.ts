import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from '@series-inc/rundot-game-sdk/vite';
import { resolveSandboxGameId } from './sandbox.config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Env is scoped to this game's root only. Each workshop game owns its own
// `.env` / `.env.example`; we never walk up into a parent monorepo.
const envDir = rootDir;

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };

  return {
    plugins: [
      react(), // Must come first - handles JSX transform
      rundotGameLibrariesPlugin(),
      rundotGamePlaygroundPlugin({
        gameId: resolveSandboxGameId(rootDir),
        apiKey: env.RUNDOT_API_KEY,
      }),
    ],
    base: './',
    envDir,
    // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
    // RUN.game SDK includes top-level await, so we must target an environment that supports it.
    esbuild: { target: 'es2022' },
    optimizeDeps: {
      esbuildOptions: { target: 'es2022' },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    build: { target: 'es2022' }, // Support top-level await for embedded libraries
    // fs.allow: the voxel-kit file: dependency symlinks outside this
    // project's root; let the dev server serve its TypeScript source.
    // Setting `allow` replaces Vite's default list, so '.' (the project
    // root) must be included explicitly. Paths resolve relative to root.
    server: { port: 4318, strictPort: true, fs: { allow: ['.', '../../tools/voxel-kit'] } },
  };
});
