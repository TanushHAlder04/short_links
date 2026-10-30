import 'dotenv/config'
import { prisma } from '../lib/prisma.js'
import {
  backfillBatch,
  validateBackfill,
  normalizeLegacyLinks,
} from '../lib/services/backfill.js'
// Explicit operator command; never called by build, deploy, or startup.
try {
  if (process.argv.includes('--validate')) console.log(await validateBackfill())
  else if (process.argv.includes('--normalize-links')) {
    let result
    do {
      result = await normalizeLegacyLinks()
      console.log(result)
    } while (!result.complete)
  } else {
    let result
    do {
      result = await backfillBatch()
      console.log(result)
    } while (!result.complete)
  }
} finally {
  await prisma.$disconnect()
}
