import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'spike-results',
      'dist-ssr',
      'docs',
      '.claude',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Render-loop code deliberately keeps per-frame state in plain mutable objects/refs outside
    // React (TECHNICAL_BLUEPRINT.md §14). These two React Compiler rules forbid exactly that
    // pattern; the project does not use the React Compiler. They stay ON for all UI code.
    files: ['src/engine/**/*.{ts,tsx}', 'src/chapters/**/*.{ts,tsx}', 'src/spikes/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts', '*.config.ts', 'e2e/**/*.ts', 'e2e-spikes/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
