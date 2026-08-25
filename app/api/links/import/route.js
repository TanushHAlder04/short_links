// app/api/links/import/route.js
// Batch CSV / JSON link import with row-by-row validation, bloom filter gatekeeping, and rate limiting.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/apikeys'
import { checkRateLimit } from '@/lib/ratelimit'
import { generateUniqueCode, validateAlias, isValidUrl } from '@/lib/shortcode'
import { shortCodeBloom } from '@/lib/bloom'
import { cacheSet } from '@/lib/redis'

function parseCsvToObjects(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const parseRow = (rowStr) => {
    const matches = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i]
      if (char === '"') {
        if (inQuotes && rowStr[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        matches.push(cur.trim())
        cur = ''
      } else {
        cur += char
      }
    }
    matches.push(cur.trim())
    return matches
  }

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || ''
    })
    rows.push(obj)
  }

  return rows
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = await getAuthUserId(request, session)

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { allowed, reset } = await checkRateLimit(`links-import:${userId}`, {
      limit: 5,
      windowMs: 60_000,
    })

    if (!allowed) {
      return Response.json(
        { error: 'Too many import requests. Please slow down.' },
        { status: 429, headers: { 'X-RateLimit-Reset': String(reset), 'Retry-After': '60' } }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    let rawRows = []

    if (contentType.includes('application/json')) {
      const body = await request.json()
      rawRows = Array.isArray(body.rows) ? body.rows : []
    } else {
      const text = await request.text()
      rawRows = parseCsvToObjects(text)
    }

    if (!rawRows || rawRows.length === 0) {
      return Response.json({ error: 'No link records found in request payload' }, { status: 400 })
    }

    if (rawRows.length > 100) {
      return Response.json({ error: 'Maximum 100 links allowed per bulk import batch' }, { status: 400 })
    }

    const results = []
    let imported = 0
    let failed = 0

    // Process rows sequentially to maintain Bloom filter & rate limit stability
    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index]
      const originalUrl = row.originalurl || row.url || row.originalUrl
      const customAlias = (row.customalias || row.alias || row.customAlias || '').trim()
      const iosUrl = (row.iosurl || row.iosUrl || '').trim()
      const androidUrl = (row.androidurl || row.androidUrl || '').trim()

      if (!originalUrl || !isValidUrl(originalUrl)) {
        failed++
        results.push({ row: index + 1, originalUrl, status: 'failed', error: 'Invalid or missing HTTP/HTTPS URL' })
        continue
      }

      if (iosUrl && !isValidUrl(iosUrl)) {
        failed++
        results.push({ row: index + 1, originalUrl, status: 'failed', error: 'Invalid iOS URL' })
        continue
      }

      if (androidUrl && !isValidUrl(androidUrl)) {
        failed++
        results.push({ row: index + 1, originalUrl, status: 'failed', error: 'Invalid Android URL' })
        continue
      }

      try {
        let shortCode
        let linkRecord

        const dbInsert = async (code) => {
          linkRecord = await prisma.url.create({
            data: {
              shortCode: code,
              originalUrl,
              iosUrl: iosUrl || null,
              androidUrl: androidUrl || null,
              customAlias: customAlias || null,
              userId,
            },
          })
        }

        if (customAlias) {
          const val = validateAlias(customAlias)
          if (!val.valid) {
            failed++
            results.push({ row: index + 1, originalUrl, status: 'failed', error: val.error })
            continue
          }

          const existing = await prisma.url.findUnique({ where: { shortCode: customAlias } })
          if (existing) {
            failed++
            results.push({ row: index + 1, originalUrl, status: 'failed', error: 'Custom alias is already taken' })
            continue
          }

          shortCode = customAlias
          await dbInsert(shortCode)
          shortCodeBloom.add(shortCode)
        } else {
          shortCode = await generateUniqueCode({
            bloomFilter: shortCodeBloom,
            dbInsertCallback: dbInsert,
            dbCheckCallback: async (code) => {
              const existing = await prisma.url.findUnique({ where: { shortCode: code } })
              return !!existing
            },
          })
        }

        await cacheSet(shortCode, {
          originalUrl,
          iosUrl: iosUrl || null,
          androidUrl: androidUrl || null,
          clickCount: 0,
          isActive: true,
          expiresAt: null,
        })

        imported++
        results.push({ row: index + 1, originalUrl, shortCode, status: 'success' })
      } catch (err) {
        failed++
        results.push({ row: index + 1, originalUrl, status: 'failed', error: err.message || 'Database creation error' })
      }
    }

    return Response.json({
      success: true,
      total: rawRows.length,
      imported,
      failed,
      results,
    })
  } catch (error) {
    console.error('POST /api/links/import error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
