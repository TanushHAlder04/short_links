import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import SessionWrapper from '@/components/SessionWrapper'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: {
    default: 'ShortLinks — Scalable URL Shortener with Analytics',
    template: '%s | ShortLinks',
  },
  description:
    'Create short links, track clicks, view real-time analytics, and manage campaigns. Built with Redis caching, PostgreSQL, and async analytics processing.',
  keywords: ['url shortener', 'link analytics', 'short links', 'click tracking', 'QR code'],
  authors: [{ name: 'ShortLinks' }],
  openGraph: {
    title: 'ShortLinks — Scalable URL Shortener with Analytics',
    description: 'Track every click. Cache every redirect. Understand your audience.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased" style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: '100vh' }}>
        <SessionWrapper>
          <Navbar />
          {children}
          <Footer />
        </SessionWrapper>
      </body>
    </html>
  )
}
