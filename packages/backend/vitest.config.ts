import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Run test files sequentially to prevent shared-db race conditions
    // (all tests share the same better-sqlite3 singleton)
    fileParallelism: false,
  },
})
