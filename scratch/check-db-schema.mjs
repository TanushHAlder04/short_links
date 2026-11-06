import 'dotenv/config'
import pg from 'pg'

async function check() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `)
    console.log('Tables:', tables.rows.map(r => r.table_name))
  } catch (err) {
    console.error('Error:', err)
  } finally {
    await pool.end()
  }
}

check()
