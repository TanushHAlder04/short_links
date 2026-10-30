import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
if (!process.env.npm_execpath) throw new Error('Run through npm run audit:report')
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'audit', '--omit=dev', '--json'], { encoding: 'utf8' })
mkdirSync('reports', { recursive: true })
writeFileSync('reports/npm-audit.json', result.stdout || '{}')
try {
  console.log(
    JSON.parse(result.stdout).metadata?.vulnerabilities ||
      'Audit report unavailable'
  )
} catch {
  console.error('Audit did not produce JSON; review the report')
}
// Reporting is non-blocking; advisories require review, not forced major upgrades.
