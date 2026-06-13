// app/api/qr/[shortCode]/route.js
// Returns a QR code as PNG image for the given short code.

import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'

export async function GET(request, { params }) {
  const { shortCode } = await params

  const url = await prisma.url.findUnique({
    where: { shortCode, isActive: true },
    select: { shortCode: true },
  })

  if (!url) {
    return new Response('Not found', { status: 404 })
  }

  const shortUrl = `${process.env.NEXT_PUBLIC_HOST}/${shortCode}`

  const pngBuffer = await QRCode.toBuffer(shortUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    color: { dark: '#1e1b4b', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })

  return new Response(pngBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400', // Cache QR for 24 hours
      'Content-Disposition': `inline; filename="qr-${shortCode}.png"`,
    },
  })
}
