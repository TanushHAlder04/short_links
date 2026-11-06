import 'dotenv/config'
import { createLink } from '../lib/services/links.js'
import { prisma } from '../lib/prisma.js'

async function run() {
  try {
    const res = await createLink({ url: 'https://example.com' }, {}, null)
    console.log('Success:', res)
  } catch (err) {
    console.error('createLink error:', err)
  } finally {
    await prisma.$disconnect()
    process.exit(0)
  }
}

run()
