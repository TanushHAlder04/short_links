import { defineConfig } from 'vitest/config'
import { transformWithOxc } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    {
      name: 'application-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (/\/(app|components)\/.*\.js$/.test(id))
          return transformWithOxc(code, id, {
            lang: 'jsx',
            jsx: { runtime: 'automatic' },
            sourcemap: true,
          })
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/*.test.js', 'tests/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.js', 'app/**/*.js', 'components/**/*.{js,jsx}'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
    },
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
