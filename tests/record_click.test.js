import { it, expect, vi, beforeEach } from 'vitest'
vi.mock('../lib/prisma', () => ({ prisma: { $transaction: vi.fn(), click: { create: vi.fn() }, url: { update: vi.fn() } } }))
vi.mock('../lib/webhooks', () => ({ sendWebhook: vi.fn() }))
import { prisma } from '../lib/prisma'
import { sendWebhook } from '../lib/webhooks'
import { recordClick } from '../lib/analytics'
const click = { shortCode: 'abc', ip: '127.0.0.1', userAgent: '', referrer: null }
beforeEach(() => {
  vi.clearAllMocks()
  prisma.$transaction.mockImplementation(fn => fn(prisma))
  prisma.click.create.mockResolvedValue({})
  prisma.url.update.mockResolvedValue({ shortCode: 'abc', clickCount: 10, webhookUrl: 'https://hooks.example.com', webhookSecret: 'secret' })
  sendWebhook.mockResolvedValue()
})
it('waits for the transaction and signed webhook before resolving', async () => {
  let release
  sendWebhook.mockImplementation(() => new Promise(resolve => { release = resolve }))
  let done = false
  const work = recordClick(click).then(() => { done = true })
  await vi.waitFor(() => expect(sendWebhook).toHaveBeenCalled())
  expect(done).toBe(false)
  expect(prisma.click.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isBot: false }) })
  expect(sendWebhook.mock.calls[0][2]['X-ShortLinks-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/)
  release()
  await work
  expect(done).toBe(true)
})
it('records bots without incrementing the human count or delivering webhooks', async () => {
  await recordClick({ ...click, userAgent: 'Googlebot' })
  expect(prisma.click.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isBot: true }) })
  expect(prisma.url.update).not.toHaveBeenCalled()
  expect(sendWebhook).not.toHaveBeenCalled()
})
it('does not send a webhook when the transaction fails', async () => {
  prisma.$transaction.mockRejectedValueOnce(new Error('rollback'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await recordClick(click)
  expect(sendWebhook).not.toHaveBeenCalled()
  log.mockRestore()
})
