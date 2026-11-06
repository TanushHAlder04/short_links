import 'dotenv/config'
import pg from 'pg'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

async function recordMigrations() {
  const dbUrl = new URL(process.env.DATABASE_URL)
  dbUrl.port = '5432'
  dbUrl.searchParams.delete('pgbouncer')

  const pool = new pg.Pool({ connectionString: dbUrl.toString() })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum"              VARCHAR(64) NOT NULL,
        "finished_at"           TIMESTAMPTZ,
        "migration_name"        VARCHAR(255) NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        TIMESTAMPTZ,
        "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
      );
    `)

    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
    const migrationFolders = ['20260825000000_init', '20260929000000_durable_analytics', '20261104000000_schema_optimizations']

    for (const folder of migrationFolders) {
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql')
      const content = fs.readFileSync(sqlFile, 'utf8')
      const checksum = crypto.createHash('sha256').update(content).digest('hex')

      const existing = await pool.query('SELECT id FROM "_prisma_migrations" WHERE migration_name = $1', [folder])
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
          VALUES ($1, $2, now(), $3, 1)
        `, [crypto.randomUUID(), checksum, folder])
        console.log('Recorded migration as applied:', folder)
      } else {
        console.log('Already recorded:', folder)
      }
    }
  } catch (err) {
    console.error(err)
  } finally {
    await pool.end()
  }
}

recordMigrations()

