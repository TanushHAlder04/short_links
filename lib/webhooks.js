// Validate at save time AND delivery time; pin DNS to prevent rebinding.
import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'
import { request } from 'node:https'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(address, prefix, 'ipv4')
blocked.addAddress('168.63.129.16', 'ipv4') // Cloud platform virtual address
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
]) blocked.addSubnet(address, prefix, 'ipv6')

export function isPublicAddress(address) {
  const family = isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
  return false
}

export async function resolveWebhook(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('Webhook must be a valid HTTPS URL') }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password) {
    throw new Error('Webhook must use HTTPS on port 443 without credentials')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  let timer
  try {
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await Promise.race([
        lookup(hostname, { all: true }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Webhook DNS lookup timed out')), 2000) }),
      ])
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new Error('Webhook must resolve only to public internet addresses')
    }
    return { url, address: addresses[0] }
  } finally { clearTimeout(timer) }
}

export async function sendWebhook(value, payload, headers) {
  const { url, address } = await resolveWebhook(value)
  await new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST', agent: false,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
      // Keep the original hostname for TLS/Host, but never resolve it again.
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address])
        else callback(null, address.address, address.family)
      },
      signal: AbortSignal.timeout(3000),
    }, (res) => {
      const status = res.statusCode || 0
      res.destroy() // No response body is needed; never follow redirects.
      if (status >= 200 && status < 300) resolve()
      else reject(new Error(`Webhook returned HTTP ${status}`))
    })
    req.on('error', reject)
    req.end(payload)
  })
}
