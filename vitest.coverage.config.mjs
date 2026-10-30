import { mergeConfig } from 'vitest/config'
import base from './vitest.config.mjs'
export default mergeConfig(base, {
  test: {
    include: [
      'tests/*.test.js',
      'tests/*.test.jsx',
      'tests/integration/**/*.test.js',
    ],
    coverage: { thresholds: { lines: 38, statements: 36, branches: 42, functions: 29 } },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
