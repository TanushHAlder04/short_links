import 'dotenv/config'
const required = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_HOST',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_ID',
  'GITHUB_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'IP_HASH_SALT',
]
if (process.env.NODE_ENV === 'production')
  required.push('INNGEST_EVENT_KEY', 'INNGEST_SIGNING_KEY')
let invalid = false
for (const key of required)
  if (!process.env[key]) {
    console.error(`${key}: missing`)
    invalid = true
  }
for (const key of [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_HOST',
  'UPSTASH_REDIS_REST_URL',
])
  if (process.env[key]) {
    try {
      new URL(process.env[key])
    } catch {
      console.error(`${key}: invalid URL`)
      invalid = true
    }
  }
for (const key of ['NEXTAUTH_SECRET', 'IP_HASH_SALT'])
  if (process.env[key] && process.env[key].length < 32) {
    console.error(`${key}: use at least 32 random characters`)
    invalid = true
  }
if (process.env.NODE_ENV === 'production' && process.env.INNGEST_DEV) {
  console.error('INNGEST_DEV must be unset in production')
  invalid = true
}
console.log(
  invalid
    ? 'Environment validation failed (values redacted)'
    : 'Required environment configuration is present; provider connectivity not checked'
)
process.exitCode = invalid ? 1 : 0
