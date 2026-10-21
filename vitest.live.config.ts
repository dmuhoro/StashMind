import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.git'],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname ?? '.', '.'),
    },
  },
});
