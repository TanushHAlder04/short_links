import { AppError } from './errors.js'
export async function readText(request, limit = 32768) {
  if (Number(request.headers.get('content-length') || 0) > limit)
    throw new AppError('Request too large', 413)
  const reader = request.body?.getReader()
  if (!reader) return ''
  let bytes = 0
  const chunks = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw new AppError('Request too large', 413)
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks).toString('utf8')
}
export async function readJson(request, limit) {
  try {
    return JSON.parse(await readText(request, limit))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Invalid JSON')
  }
}
export function checkSessionOrigin(request, identity) {
  if (
    identity?.type !== 'session' ||
    ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  )
    return
  const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin
  if (request.headers.get('origin') !== expected)
    throw new AppError('Origin not allowed', 403)
}
