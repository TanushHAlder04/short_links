import 'dotenv/config'
import pg from 'pg'

async function inspectAll() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `)
    const byTable = {}
    for (const r of res.rows) {
      byTable[r.table_name] = byTable[r.table_name] || []
      byTable[r.table_name].push(r.column_name)
    }
    console.log(JSON.stringify(byTable, null, 2))
  } catch (err) {
    console.error(err)
  } finally {
    await pool.end()
  }
}

inspectAll()

