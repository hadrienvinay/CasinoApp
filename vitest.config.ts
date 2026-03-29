import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': '/Users/hadrienvinay/Documents/Code/poker/src',
    },
  },
});
