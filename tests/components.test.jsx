// @vitest-environment jsdom
import React from 'react'
import { it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import DuplicateChoice from '../components/DuplicateChoice.js'
import TrafficFilter from '../components/TrafficFilter.js'
import WebhookDeliveries from '../components/WebhookDeliveries.js'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('lets the owner explicitly reuse or create another link', () => {
  const onReuse = vi.fn(),
    onCreate = vi.fn(),
    link = { shortCode: 'abc1234', isActive: true }
  render(
    <DuplicateChoice links={[link]} onReuse={onReuse} onCreate={onCreate} />
  )
  fireEvent.click(screen.getByText('Reuse /abc1234'))
  expect(onReuse).toHaveBeenCalledWith(link)
  fireEvent.click(screen.getByText('Create another'))
  expect(onCreate).toHaveBeenCalledTimes(1)
})
it('exposes all three traffic definitions', () => {
  const onChange = vi.fn()
  render(<TrafficFilter value="human" onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Traffic'), {
    target: { value: 'bot' },
  })
  expect(onChange).toHaveBeenCalledWith('bot')
})
it('shows failed delivery and retries using its identity', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deliveries: [
          { id: 'delivery', milestone: 10, status: 'failed', attemptCount: 5 },
        ],
      }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deliveries: [
          { id: 'delivery', milestone: 10, status: 'pending', attemptCount: 5 },
        ],
      }),
    })
  vi.stubGlobal('fetch', fetch)
  render(<WebhookDeliveries shortCode="abc1234" />)
  fireEvent.click(await screen.findByText('Retry delivery'))
  await screen.findByText('10 clicks: pending (5 attempts)')
  expect(fetch.mock.calls[1][1].body).toBe(
    JSON.stringify({ deliveryId: 'delivery' })
  )
})
