import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = import.meta.dirname;

// Two entry pages from one codebase (TECHNICAL_BLUEPRINT.md §2.1):
//   /        → the cinematic journey (WebGL)
//   /brief/  → Mission Brief (no WebGL; prerendered to static HTML in a later phase)
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        journey: resolve(root, 'index.html'),
        brief: resolve(root, 'brief/index.html'),
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
});
