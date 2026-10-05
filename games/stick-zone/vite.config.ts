import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5196,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 4196,
    strictPort: true,
    host: true,
  },
});
