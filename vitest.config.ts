import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.test.json'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        perFile: true
      }
    },
  },
});
