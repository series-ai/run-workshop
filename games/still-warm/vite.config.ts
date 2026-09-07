import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  rundotGameLibrariesPlugin,
  rundotGamePlaygroundPlugin,
} from '@series-inc/rundot-game-sdk/vite';

export default defineConfig({
  plugins: [react(), rundotGameLibrariesPlugin(), rundotGamePlaygroundPlugin()],
  base: './',
  esbuild: { target: 'es2022' },
  optimizeDeps: {
    esbuildOptions: { target: 'es2022' },
    exclude: ['@series-inc/rundot-game-sdk'],
  },
  build: { target: 'es2022' },
  server: {
    host: '127.0.0.1',
    port: 4318,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', '.getbb.app'],
    fs: { allow: ['.', '../../tools/dither-kit'] },
  },
});
