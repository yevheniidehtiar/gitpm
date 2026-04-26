import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/index.ts',
        '**/types.ts',
        'packages/ui/**',
      ],
      reporter: ['text', 'text-summary'],
    },
  },
});
