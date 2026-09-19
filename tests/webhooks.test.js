import { it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ request: vi.fn() }))
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { isPublicAddress, resolveWebhook, sendWebhook } from '../lib/webhooks'
beforeEach(() => { vi.clearAllMocks(); lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]) })
it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2002:7f00:1::', '2001:db8::1'])('rejects non-public address %s', (ip) => { expect(isPublicAddress(ip)).toBe(false) })
it.each(['8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (ip) => { expect(isPublicAddress(ip)).toBe(true) })
it.each(['http://example.com', 'https://example.com:8443', 'https://user:pass@example.com', 'https://127.1', 'https://[::1]', 'https://2130706433'])('rejects unsafe URL %s', async url => { await expect(resolveWebhook(url)).rejects.toThrow() })
it('rejects mixed public/private DNS answers', async () => {
  lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }])
  await expect(resolveWebhook('https://example.com')).rejects.toThrow('public')
})
it('pins the checked DNS answer and refuses redirect responses', async () => {
  request.mockImplementation((_url, options, callback) => {
    const pinned = vi.fn()
    options.lookup('example.com', { all: true }, pinned)
    expect(pinned).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }])
    const req = new EventEmitter()
    req.end = () => callback({ statusCode: 302, destroy: vi.fn() })
    return req
  })
  await expect(sendWebhook('https://example.com', '{}', {})).rejects.toThrow('302')
  expect(lookup).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledTimes(1)
})
