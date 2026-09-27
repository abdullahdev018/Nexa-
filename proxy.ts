import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

/**
 * An optimistic gate in front of the signed-in routes.
 *
 * It only checks that a session cookie is *present* — it never reads the
 * database, because proxy runs on every matched request and must stay fast.
 * The real check is `requireUser()` in the layout, which validates the session
 * and redirects if it is expired or forged. This exists so a signed-out
 * visitor is bounced straight to login instead of rendering a page shell first.
 */
const PROTECTED = [
  '/dashboard',
  '/campaigns',
  '/content',
  '/video',
  '/ads',
  '/brand',
  '/calendar',
  '/analytics',
  '/billing',
  '/research',
  '/chat',
  '/settings',
  '/account',
  '/onboarding',
]

/** Methods that change something. Every one of them must come from this site. */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Refuses a state-changing API request that did not come from this origin.
 *
 * The session cookie is SameSite=Lax, which already keeps it off cross-site
 * POSTs — but "site" includes sibling subdomains, which Lax trusts. This closes
 * that gap: browsers send `Sec-Fetch-Site` (and `Origin`) on every such
 * request, and anything other than same-origin is turned away.
 */
function crossOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) return fetchSite !== 'same-origin' && fetchSite !== 'none'

  const origin = request.headers.get('origin')
  if (!origin) return false // Not a browser, or a same-origin request from an old one.
  try {
    return new URL(origin).host !== request.headers.get('host')
  } catch {
    return true
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/api/')) {
    if (MUTATING.has(request.method) && crossOrigin(request)) {
      return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
    }
    return NextResponse.next()
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  const isProtected = PROTECTED.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Remember where they were going, so login can return them there.
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    return NextResponse.redirect(url)
  }

  // A signed-in visitor has no use for the sign-in forms.
  if (hasSession && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/campaigns/:path*',
    '/content/:path*',
    '/video/:path*',
    '/ads/:path*',
    '/brand/:path*',
    '/calendar/:path*',
    '/analytics/:path*',
    '/billing/:path*',
    '/research/:path*',
    '/chat/:path*',
    '/settings/:path*',
    '/account/:path*',
    '/onboarding',
    '/login',
    '/signup',
    '/api/:path*',
  ],
}
