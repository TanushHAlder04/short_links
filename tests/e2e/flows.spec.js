import { readFile, writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { processClick } from '../../lib/services/analytics.js'
let userId, sessionToken
const origin = 'http://localhost:3100'
test.beforeAll(async () => {
  userId = `e2e-${randomUUID()}`
  sessionToken = randomUUID()
  await prisma.user.create({
    data: { id: userId, name: 'Test User', email: `${userId}@example.test` },
  })
  await prisma.session.create({
    data: { sessionToken, userId, expires: new Date(Date.now() + 3600000) },
  })
})
test.afterAll(async () => {
  await prisma.$disconnect()
})
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: sessionToken,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
})
const create = async (request) => {
  const r = await request.post('/api/generate', {
    headers: { Origin: origin },
    data: { url: `https://example.com/${randomUUID()}` },
  })
  expect(r.status()).toBe(200)
  return r.json()
}
test('API creation, alias conflict, ownership, CSV, expiry, tombstone, webhook retry', async ({
  page,
}) => {
  const request = page.request,
    link = await create(request)
  expect(link.shortCode).toHaveLength(8)
  const alias = `test-${randomUUID().slice(0, 8)}`,
    headers = { Origin: origin }
  expect(
    (
      await request.post('/api/generate', {
        headers,
        data: { url: 'https://example.com', customAlias: alias },
      })
    ).status()
  ).toBe(200)
  expect(
    (
      await request.post('/api/generate', {
        headers,
        data: { url: 'https://example.org', customAlias: alias },
      })
    ).status()
  ).toBe(409)
  const other = await prisma.url.create({
    data: {
      shortCode: `other-${randomUUID().slice(0, 8)}`,
      originalUrl: 'https://example.com',
    },
  })
  expect(
    (await request.get(`/api/analytics/${other.shortCode}`)).status()
  ).toBe(404)
  expect(
    (
      await request.patch(`/api/links/${other.shortCode}`, {
        headers,
        data: { isActive: false },
      })
    ).status()
  ).toBe(404)
  const csv = await request.post('/api/links/import', {
    headers,
    data: {
      rows: [{ url: 'https://example.org/import' }, { url: 'javascript:bad' }],
    },
  })
  expect((await csv.json()).imported).toBe(1)
  const redirect = await request.get(`/${link.shortCode}`, { maxRedirects: 0 })
  expect(redirect.status()).toBe(302)
  expect(
    (
      await request.patch(`/api/links/${link.shortCode}`, {
        headers,
        data: { url: 'https://example.org/edited', isActive: false },
      })
    ).status()
  ).toBe(200)
  expect(
    (await request.get(`/${link.shortCode}`, { maxRedirects: 0 })).status()
  ).toBe(410)
  await prisma.url.update({
    where: { shortCode: link.shortCode },
    data: { isActive: true, expiresAt: new Date(Date.now() - 1) },
  })
  expect(
    (await request.get(`/${link.shortCode}`, { maxRedirects: 0 })).status()
  ).toBe(410)
  const d = await prisma.webhookDelivery.create({
    data: {
      eventId: randomUUID(),
      sourceEventId: randomUUID(),
      linkId: link.shortCode,
      milestone: 10,
      destination: 'https://example.com/hook',
      status: 'failed',
    },
  })
  expect(
    (
      await request.post(`/api/links/${link.shortCode}/webhooks`, {
        headers,
        data: { deliveryId: d.id },
      })
    ).status()
  ).toBe(200)
  expect(
    (await request.delete(`/api/links/${link.shortCode}`, { headers })).status()
  ).toBe(200)
  expect((await request.get(`/api/links/${link.shortCode}`)).status()).toBe(404)
  expect(
    (await request.get('/never-existed-code', { maxRedirects: 0 })).status()
  ).toBe(404)
  expect(
    (
      await request.post('/api/generate', {
        headers: { Origin: 'https://evil.example' },
        data: { url: 'https://example.com' },
      })
    ).status()
  ).toBe(403)
})
test('Chromium creation, 302, analytics dashboard, duplicate choice and edit', async ({
  page,
}) => {
  const destination = `https://example.com/browser-${randomUUID()}`
  await page.goto('/shorten')
  await page.locator('#url-input').fill(destination)
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/generate') && r.request().method() === 'POST'
  )
  await page.locator('#generate-btn').click()
  const created = await (await response).json()
  expect(created.shortCode).toHaveLength(8)
  await expect(
    page.getByText(`${origin}/${created.shortCode}`, { exact: true })
  ).toBeVisible()
  expect(
    (
      await page.request.get(`/${created.shortCode}`, { maxRedirects: 0 })
    ).status()
  ).toBe(302)
  // Deterministic DB processing exercises the production service; Dev Server transport has its own test.
  await processClick({
    eventId: randomUUID(),
    linkId: created.shortCode,
    clickedAt: new Date().toISOString(),
    userAgent: 'Mozilla/5.0 Chrome/130.0',
    referrer: '',
    country: 'Unknown',
    ipHash: null,
  })
  await page.goto(`/dashboard/${created.shortCode}`)
  await expect(page.getByText('Lifetime Clicks', { exact: true })).toBeVisible()
  await expect
    .poll(async () => {
      const r = await page.request.get(`/api/analytics/${created.shortCode}`)
      return (await r.json()).totalClicks
    })
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Edit destinations' }).click()
  await page
    .getByRole('textbox', { name: 'Destination URL', exact: true })
    .fill('https://example.org/updated')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByText('https://example.org/updated', { exact: true }).first()
  ).toBeVisible()
  await page.goto('/shorten')
  await page.locator('#url-input').fill('https://example.org/updated')
  await page.locator('#generate-btn').click()
  await expect(
    page.getByRole('region', { name: 'Existing links' })
  ).toBeVisible()
  await page
    .getByRole('button', { name: `Reuse /${created.shortCode}` })
    .click()
  await expect(
    page.getByText(`${origin}/${created.shortCode}`, { exact: true })
  ).toBeVisible()
  await page.goto('/shorten')
  await page.locator('#url-input').fill('https://example.org/updated')
  await page.locator('#generate-btn').click()
  const another = page.waitForResponse(
    (r) => r.url().endsWith('/api/generate') && r.request().method() === 'POST'
  )
  await page
    .getByRole('button', { name: 'Create another', exact: true })
    .click()
  expect((await (await another).json()).shortCode).not.toBe(created.shortCode)
})

test('Inngest Dev Server counts duplicate deliveries once and retries a failed transaction', async ({
  page,
}) => {
  const health = await page.request.get('http://127.0.0.1:8288/health')
  expect(health.ok()).toBe(true)
  // Explicitly sync the SDK endpoint before publishing.
  await page.request.put('/api/inngest')
  const code = `job-${randomUUID().slice(0, 8)}`,
    eventId = randomUUID(),
    data = {
      eventId,
      linkId: code,
      clickedAt: new Date().toISOString(),
      userAgent: 'Chrome',
      referrer: '',
      country: 'Unknown',
      ipHash: null,
    }
  const publish = () =>
    page.request.post('http://127.0.0.1:8288/e/local-test', {
      data: { id: randomUUID(), name: 'link/clicked', data },
    })
  expect((await publish()).ok()).toBe(true)
  // The first transaction fails its foreign key. Recovery must use Inngest retries.
  await new Promise((resolve) => setTimeout(resolve, 4000))
  expect(await prisma.clickEvent.count({ where: { eventId } })).toBe(0)
  await prisma.url.create({
    data: { shortCode: code, originalUrl: 'https://example.com', userId },
  })
  await expect
    .poll(() => prisma.clickEvent.count({ where: { eventId } }), {
      timeout: 30000,
      intervals: [500, 1000, 2000],
    })
    .toBe(1)
  await publish()
  await new Promise((resolve) => setTimeout(resolve, 3000))
  expect(
    (await prisma.linkLifetimeStats.findUnique({ where: { linkId: code } }))
      .totalClicks
  ).toBe(1)
})


test('owner downloads filtered analytics CSV and a valid PDF from the dashboard',async({page})=>{
  const link=await create(page.request)
  await processClick({eventId:randomUUID(),linkId:link.shortCode,clickedAt:new Date().toISOString(),userAgent:'Chrome/130.0',referrer:'https://example.org',country:'IN',ipHash:null})
  await page.goto(`/dashboard/${link.shortCode}`)
  await page.getByLabel('Report date range').selectOption('7')
  await expect(page.getByRole('button',{name:'Export CSV',exact:true})).toBeVisible()
  await page.getByLabel('CSV export mode').selectOption('daily')
  const csvEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();const csv=await csvEvent
  const content=await readFile(await csv.path(),'utf8');expect(content).toContain('"date","shortCode","humanClicks","botClicks","totalClicks"');expect(content).toContain(link.shortCode)
  const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();const pdf=await pdfEvent
  const bytes=await readFile(await pdf.path());expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.length).toBeGreaterThan(2000)
  await pdf.saveAs('test-results/analytics-report.pdf')
  const other=await prisma.url.create({data:{shortCode:`foreign-${randomUUID().slice(0,8)}`,originalUrl:'https://foreign.example'}})
  expect((await page.request.get(`/api/reports/export?shortCode=${other.shortCode}&format=pdf`)).status()).toBe(404)
  const report=await (await page.request.get(`/api/reports/export?shortCode=${link.shortCode}&format=json&range=7`)).json()
  const dashboard=await (await page.request.get(`/api/analytics/${link.shortCode}?range=7`)).json()
  expect(report.totals.totalClicks).toBe(dashboard.windowClicks)
  await writeFile('test-results/analytics-report-expected.json',JSON.stringify({shortCode:link.shortCode,start:report.options.startDate,end:report.options.endDate,total:report.totals.totalClicks}))
  const legacy=await page.request.get('/api/links/export');expect(legacy.status()).toBe(200);expect(await legacy.text()).toContain('clickCount')
})
