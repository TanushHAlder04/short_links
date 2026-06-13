// app/api/keys/[keyId]/route.js
// Revoke an API key.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { keyId } = await params

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } })
  if (!key) return Response.json({ error: 'Key not found' }, { status: 404 })
  if (key.userId !== session.user.id) return Response.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } })

  return Response.json({ success: true })
}
