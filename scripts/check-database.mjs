// Read-only connection/schema check. Never print connection URLs or passwords.
import 'dotenv/config'
import pg from 'pg'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing.')
  process.exitCode = 1
} else {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 5000, max: 1 })
  try {
    const { rows } = await pool.query(`SELECT to_regclass('public."User"') AS users, to_regclass('public."Account"') AS accounts, to_regclass('public."Session"') AS sessions`)
    const missing = Object.entries(rows[0]).filter(([, value]) => !value).map(([name]) => name)
    if (missing.length) {
      console.error(`Database connected, but auth tables are missing: ${missing.join(', ')}. Apply the tracked migrations using DIRECT_URL.`)
      process.exitCode = 1
    } else console.log('Database connection succeeded; User, Account, and Session tables exist.')
  } catch (error) {
    const message = String(error.message || '')
    const hint = /tenant|user not found/i.test(message)
      ? 'Supabase pooler cannot match the host and username. Copy the complete URI from the project Connect dialog; pooler usernames include the project reference.'
      : error.code === 'ENOTFOUND'
        ? 'Database hostname could not be resolved. Check the copied host, project status, and DNS.'
        : error.code === '28P01'
          ? 'Database password authentication failed. Check the DB password and URL encoding.'
          : 'Database connection failed. Check host, credentials, network access, and project status.'
    console.error(JSON.stringify({ code: error.code || 'CONNECTION_ERROR', hint }))
    process.exitCode = 1
  } finally { await pool.end() }
}
