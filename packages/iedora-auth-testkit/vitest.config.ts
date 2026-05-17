import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // PGLite WASM init + Better Auth boot can spike on cold cache.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
  },
})
