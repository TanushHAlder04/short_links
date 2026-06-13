// app/api/keys/route.js
// API Key management — list and create API keys.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { createApiKey } from '@/lib/apikeys'
import { checkRateLimit } from '@/lib/ratelimit'

// GET /api/keys — list user's API keys (no plaintext shown)
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, createdAt: true, lastUsed: true, isActive: true },
    orderBy: { createdAt: 'desc' },
  })

  return Response.json({ keys })
}

// POST /api/keys — create a new API key
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 10 key-creation attempts per minute per user
  const { allowed, reset } = await checkRateLimit(`key-create:${session.user.id}`, { limit: 10, windowMs: 60_000 })
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'X-RateLimit-Reset': String(reset), 'Retry-After': '60' } }
    )
  }

  const { name } = await request.json()
  if (!name || name.trim().length < 2) {
    return Response.json({ error: 'Key name must be at least 2 characters' }, { status: 400 })
  }

  // Limit to 5 active keys per user
  const activeCount = await prisma.apiKey.count({
    where: { userId: session.user.id, isActive: true },
  })
  if (activeCount >= 5) {
    return Response.json({ error: 'Maximum 5 active API keys allowed' }, { status: 429 })
  }

  const { key, keyId } = await createApiKey(session.user.id, name.trim())

  return Response.json({
    success: true,
    keyId,
    name: name.trim(),
    key, // ⚠️ Returned ONCE — never shown again
    message: 'Copy this key now — it will never be shown again.',
  })
}
