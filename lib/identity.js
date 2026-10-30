import { prisma } from './prisma.js'
import { getServerSession } from 'next-auth'
import { authOptions } from '../app/api/auth/[...nextauth]/route.js'
import { validateApiKey } from './apikeys.js'
import { AppError } from './errors.js'
import { checkSessionOrigin } from './request.js'
export async function identityFor(
  request,
  { required = false, sessionOnly = false } = {}
) {
  const authorization = request.headers.get('authorization')
  let identity = {}
  if (authorization && !sessionOnly) {
    const key = await validateApiKey(authorization)
    if (!key) throw new AppError('Invalid API key', 401)
    identity = { userId: key.userId, apiKeyId: key.id, type: 'apiKey' }
  } else {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      identity = { userId: session.user.id, type: 'session' }
    } else {
      // NextAuth can return null after catching an adapter failure. Distinguish
      // that from an expired cookie so a DB outage does not masquerade as logout.
      const cookie = request.headers.get('cookie')?.split(';').find(part =>
        /^(?:__Secure-)?next-auth\.session-token=/.test(part.trim()))
      if (cookie) {
        const sessionToken = cookie.slice(cookie.indexOf('=') + 1).trim()
        await prisma.session.findUnique({ where: { sessionToken }, select: { id: true } })
      }
    }
  }
  if (required && !identity.userId) throw new AppError('Sign in required', 401)
  checkSessionOrigin(request, identity)
  return identity
}
