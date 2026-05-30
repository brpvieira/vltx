import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    clearMocks: true,
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.test.json'
    }
  },
});
