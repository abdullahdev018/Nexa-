import type { NextConfig } from 'next'

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Sent with every response.
 *
 * The CSP is deliberately narrow: it forbids framing (clickjacking against the
 * one-click delete buttons), plugins, <base> rewriting and cross-site form
 * posts. It does not restrict scripts — that needs a per-request nonce threaded
 * through rendering, and is a separate change.
 */
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Only once served over HTTPS; on localhost it would pin the browser to https.
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
]

const nextConfig: NextConfig = {
  // Hides the floating dev badge that sits over the bottom-left of the app in
  // development. Compile and runtime errors are still surfaced.
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
