import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'e2e/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        console: 'readonly', window: 'readonly', document: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly',
        clearInterval: 'readonly', fetch: 'readonly', localStorage: 'readonly',
        sessionStorage: 'readonly', navigator: 'readonly', performance: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        HTMLCanvasElement: 'readonly', HTMLDivElement: 'readonly', HTMLElement: 'readonly',
        HTMLInputElement: 'readonly', HTMLButtonElement: 'readonly',
        Element: 'readonly', Event: 'readonly', MouseEvent: 'readonly',
        TouchEvent: 'readonly', KeyboardEvent: 'readonly', PointerEvent: 'readonly',
        File: 'readonly', Blob: 'readonly', URL: 'readonly',
        Map: 'readonly', Set: 'readonly', Promise: 'readonly', WeakMap: 'readonly',
        WeakSet: 'readonly', Symbol: 'readonly', Array: 'readonly', Object: 'readonly',
        String: 'readonly', Number: 'readonly', Boolean: 'readonly', Date: 'readonly',
        Math: 'readonly', JSON: 'readonly', RegExp: 'readonly', Error: 'readonly',
        TypeError: 'readonly', process: 'readonly', global: 'readonly',
        globalThis: 'readonly', module: 'readonly', require: 'readonly',
        __dirname: 'readonly', __filename: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-console': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/tests/**/*.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly', beforeAll: 'readonly',
        afterAll: 'readonly', vi: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
