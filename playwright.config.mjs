import { defineConfig } from '@playwright/test'
const database = process.env.TEST_DATABASE_URL
if (!database)
  throw Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database')
const u = new URL(database)
if (
  !['localhost', '127.0.0.1', 'postgres'].includes(u.hostname) ||
  !u.pathname.includes('test')
)
  throw Error('E2E requires a local test database')
process.env.DATABASE_URL = database
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3100',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'npm run start -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: database,
      DIRECT_URL: database,
      NEXTAUTH_URL: 'http://localhost:3100',
      NEXT_PUBLIC_HOST: 'http://localhost:3100',
      NEXTAUTH_SECRET: 'disposable-test-secret-not-for-production-123',
      IP_HASH_SALT: 'disposable-test-ip-salt-not-for-production-123',
      GOOGLE_CLIENT_ID: 'test',
      GOOGLE_CLIENT_SECRET: 'test',
      GITHUB_ID: 'test',
      GITHUB_SECRET: 'test',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
      INNGEST_DEV: '1',
      INNGEST_EVENT_KEY: '',
      INNGEST_SIGNING_KEY: '',
      SENTRY_DSN: '',
    },
  },
})
