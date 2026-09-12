import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { DEFAULT_THEME, isTheme, THEME_COOKIE, THEME_SCRIPT } from '@/lib/theme'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Nexa AI — Think faster. Create more.',
    template: '%s · Nexa AI',
  },
  description:
    'Nexa is an AI assistant built for everyday work: smart conversations, fast answers, file analysis, coding help and writing assistance, with every chat saved and searchable.',
  applicationName: 'Nexa AI',
  keywords: ['AI assistant', 'AI chatbot', 'writing assistant', 'coding help', 'Nexa AI'],
  openGraph: {
    type: 'website',
    siteName: 'Nexa AI',
    title: 'Nexa AI — Think faster. Create more.',
    description:
      'An AI assistant built for everyday work. Smart conversations, fast answers, and a history you can actually search.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexa AI — Think faster. Create more.',
    description: 'An AI assistant built for everyday work.',
  },
  icons: {
    // The tab icon is the tight variant: at 16px the full mark's padding and
    // hairline border read as a smaller, muddier glyph than neighbouring tabs.
    icon: [
      { url: '/logo/nexa-favicon.svg', type: 'image/svg+xml' },
      { url: '/logo/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    // Home-screen icons keep the full mark, where the padding is correct.
    apple: [{ url: '/logo/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  // Matched to each theme's page background so the browser chrome on mobile
  // does not sit as a white bar above a dark app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const store = await cookies()
  const raw = store.get(THEME_COOKIE)?.value
  const theme = isTheme(raw) ? raw : DEFAULT_THEME

  return (
    // `suppressHydrationWarning`: the inline script below resolves SYSTEM
    // against the OS before React hydrates, so the class it lands on can
    // legitimately differ from what the server rendered.
    <html
      lang="en"
      className={`${inter.variable} h-full${theme === 'DARK' ? ' dark' : ''}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
