import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
