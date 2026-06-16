import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Co-located unit tests under src/ + the dedicated suite under tests/ (#25).
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Each test file gets its own worker (default forks pool) so the per-file
    // env/module singletons (DATABASE_PATH, the SQLite connection) never leak
    // across files — tests stay independent of execution order.
    isolate: true,
    // Ensure config validation and logger pick test defaults (silent logs).
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent'
    }
  }
})
