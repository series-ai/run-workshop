import { defineConfig } from 'vite';
import path from 'path';
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite';

export default defineConfig({
  base: './',
  plugins: [rundotGameLibrariesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5197,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4197,
    strictPort: true,
    host: true,
  },
  build: {
    target: 'esnext',
  },
});
