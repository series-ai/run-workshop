import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rundotGameLibrariesPlugin, rundotGameSandboxPlugin, rundotMultiplayerPlugin } from '@series-inc/rundot-game-sdk/vite';
import { resolveDevBindHost, resolveDevPort, resolveMultiplayerDevPort } from './dev-server.config';
import { resolveSandboxGameId } from './sandbox.config';

// App name is auto-detected from folder name (H5/{folder-name}/)
// CDN assets in cdn/ folder are automatically served in dev mode

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Env is scoped to this game's root only. Each workshop game owns its own
// `.env` / `.env.example`; we never walk up into a parent monorepo.
const envDir = rootDir;

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, envDir, ''),
    ...process.env,
  };
  const devHost = resolveDevBindHost(env);
  const devPort = resolveDevPort(rootDir, env);
  const multiplayerDevPort = resolveMultiplayerDevPort(rootDir, env);

  return {
    plugins: [
      react(), // Must come first - handles JSX transform
      tailwindcss(),
      rundotGameLibrariesPlugin(),
      rundotGameSandboxPlugin({
        gameId: resolveSandboxGameId(rootDir),
        apiKey: env.RUNDOT_API_KEY,
      }),
      // No-op unless rooms.config.json exists at project root. The dev sidecar
      // port is resolved explicitly so multiple projects can run in parallel.
      rundotMultiplayerPlugin({ devPort: multiplayerDevPort }),
    ],
    base: './',
    envDir,
    resolve: {
      alias: {
        // Path alias matching tsconfig @/* → src/*
        '@': path.resolve(rootDir, 'src'),
        // Template alias for installable modules that explicitly depend on core surfaces.
        '@template': path.resolve(rootDir, 'src'),
        // Module alias: @modules/* → src/modules/*
        '@modules': path.resolve(rootDir, 'src/modules'),
        // WebGPU: explicit aliases for three/webgpu and three/tsl subpath exports.
        // Three.js package.json exports handle this, but Vite's dep optimizer
        // can miss subpath exports during pre-bundling. These aliases ensure
        // reliable resolution. Safe for WebGL-only projects (unused = tree-shaken).
        // Both subpaths resolve to the same WebGPU bundle in Three.js.
        'three/webgpu': 'three/src/Three.WebGPU.js',
        'three/tsl': 'three/src/Three.WebGPU.Nodes.js',
      },
    },
    // Vite uses esbuild both for transforms and (in dev) dependency prebundling.
    // RUN.game SDK includes top-level await, so we must target an environment that supports it.
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
      exclude: ['@series-inc/rundot-game-sdk'],
    },
    build: {
      target: 'es2022', // Support top-level await for embedded libraries
    },
    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
    },
  };
});
