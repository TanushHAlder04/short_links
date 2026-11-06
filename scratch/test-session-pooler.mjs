import 'dotenv/config'
import pg from 'pg'

async function testSessionPooler() {
  const dbUrl = new URL(process.env.DATABASE_URL)
  dbUrl.port = '5432'
  dbUrl.searchParams.delete('pgbouncer')
  console.log('Testing session pooler at:', dbUrl.host, dbUrl.port)

  const pool = new pg.Pool({ connectionString: dbUrl.toString() })
  try {
    const res = await pool.query('SELECT 1 as test')
    console.log('Session pooler connected successfully!', res.rows)
  } catch (err) {
    console.error('Session pooler error:', err.message)
  } finally {
    await pool.end()
  }
}

testSessionPooler()

