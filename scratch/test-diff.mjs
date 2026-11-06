import 'dotenv/config'
import { execSync } from 'child_process'

const dbUrl = new URL(process.env.DATABASE_URL)
dbUrl.port = '5432'
dbUrl.searchParams.delete('pgbouncer')

process.env.DIRECT_URL = dbUrl.toString()

console.log('Running prisma migrate diff...')
try {
  const out = execSync(`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, {
    encoding: 'utf8',
    env: process.env
  })
  console.log('Diff SQL output:\n', out)
} catch (err) {
  console.error('Error running diff:', err.stdout || err.message)
}
