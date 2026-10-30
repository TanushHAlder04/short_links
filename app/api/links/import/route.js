import { identityFor } from '@/lib/identity'
import { enforceLimit } from '@/lib/ratelimit'
import { readJson, readText } from '@/lib/request'
import { createLink } from '@/lib/services/links'
import { cacheSet } from '@/lib/redis'
import { AppError, errorResponse } from '@/lib/errors'
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

  const headers = parseRow(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '')
  )
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
    const identity = await identityFor(request, { required: true }),
      headers = await enforceLimit(request, identity, 'import')
    const rows = request.headers
      .get('content-type')
      ?.includes('application/json')
      ? (await readJson(request, 512000)).rows
      : parseCsvToObjects(await readText(request, 512000))
    if (!Array.isArray(rows) || !rows.length || rows.length > 100)
      throw new AppError('Import between 1 and 100 rows')
    const results = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        if (!row || typeof row !== 'object' || Array.isArray(row))
          throw new AppError('Invalid row')
        const body = {
          url: row.url || row.originalurl || row.originalUrl,
          customAlias:
            row.customAlias || row.customalias || row.alias || undefined,
          iosUrl: row.iosUrl || row.iosurl || undefined,
          androidUrl: row.androidUrl || row.androidurl || undefined,
          desktopUrl: row.desktopUrl || row.desktopurl || undefined,
          expiresAt: row.expiresAt || row.expiresat || undefined,
        }
        const output = await createLink(body, identity)
        await cacheSet(output.link.shortCode, output.link)
        results.push({
          row: i + 1,
          status: 'success',
          shortCode: output.link.shortCode,
          originalUrl: output.link.originalUrl,
        })
      } catch (error) {
        results.push({
          row: i + 1,
          status: 'failed',
          input: row,
          error:
            error instanceof AppError
              ? error.message
              : 'Creation temporarily unavailable',
        })
      }
    }
    const imported = results.filter((r) => r.status === 'success').length
    return Response.json(
      {
        success: true,
        total: rows.length,
        imported,
        failed: rows.length - imported,
        results,
      },
      { headers }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
