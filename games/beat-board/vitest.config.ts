import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const rootDir = __dirname;

// Auto-dedupe: force ALL declared dependencies to resolve from this project's
// node_modules, never from a parent directory. This makes the project fully
// standalone even when nested inside a monorepo.
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf8'));
const allDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
];

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@template': path.resolve(rootDir, './src'),
      '@modules': path.resolve(rootDir, './src/modules'),
      '@series-inc/rundot-game-sdk/api': path.resolve(rootDir, './__mocks__/@series-inc/rundot-game-sdk/api.ts'),
      'react': path.resolve(rootDir, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(rootDir, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(rootDir, 'node_modules/react/jsx-dev-runtime'),
      'react-dom': path.resolve(rootDir, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(rootDir, 'node_modules/react-dom/client'),
    },
    dedupe: allDeps,
  },
  test: {
    environment: 'jsdom',
    // Some specs trigger on-demand module transforms via dynamic import();
    // under parallel load those transforms can exceed the 5s default and
    // flake even though the test logic is fast. Give them generous headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/systems/**/*.ts', 'src/stores/**/*.ts', 'src/services/**/*.ts'],
      exclude: [
        'src/systems/**/*.test.ts',
        'src/stores/**/*.test.ts',
        'src/services/**/*.test.ts',
        'src/**/__mocks__/**',
        'src/**/config.ts',
        'src/**/types.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
