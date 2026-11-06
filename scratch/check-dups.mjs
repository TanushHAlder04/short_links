import 'dotenv/config'
import pg from 'pg'

async function checkDuplicates() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const res = await pool.query(`
      SELECT "customAlias", count(*) 
      FROM "Url" 
      WHERE "customAlias" IS NOT NULL 
      GROUP BY "customAlias" 
      HAVING count(*) > 1;
    `)
    console.log('Duplicate customAlias:', res.rows)
  } catch (err) {
    console.error(err)
  } finally {
    await pool.end()
  }
}

checkDuplicates()

