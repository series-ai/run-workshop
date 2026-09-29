import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { rundotGameLibrariesPlugin } from '@series-inc/rundot-game-sdk/vite'

export default defineConfig({
  plugins: [react(), rundotGameLibrariesPlugin()],
  base: './',
  resolve: { dedupe: ['react', 'react-dom', 'three'] },
  esbuild: { target: 'es2022' },
  optimizeDeps: { exclude: ['@series-inc/rundot-game-sdk'], esbuildOptions: { target: 'es2022' } },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'], environment: 'node' },
})
