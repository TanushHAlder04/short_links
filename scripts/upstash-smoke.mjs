import { randomUUID } from 'node:crypto'
import { Redis } from '@upstash/redis'
if (process.env.CONFIRM_TEST_REDIS !== 'yes')
  throw Error('Use a dedicated test Redis and CONFIRM_TEST_REDIS=yes')
const redis = new Redis({
    url: process.env.TEST_UPSTASH_URL,
    token: process.env.TEST_UPSTASH_TOKEN,
  }),
  key = `smoke:${randomUUID()}`
try {
  await redis.set(key, 'ok', { ex: 30 })
  if ((await redis.get(key)) !== 'ok') throw Error('Smoke read failed')
  console.log('Dedicated Upstash set/get passed')
} finally {
  await redis.del(key)
}
