import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 75,
        lines: 80,
      },
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/entry.server.tsx',
        '**/root.tsx',
      ],
    },
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts', './tests/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '~': '/home/dprime/projects/niche-consumer-app',
    },
  },
});
