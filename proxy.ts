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
const PROTECTED = ['/chat', '/settings', '/account', '/onboarding']

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
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
    url.pathname = '/chat'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/chat/:path*', '/settings/:path*', '/account/:path*', '/onboarding', '/login', '/signup'],
}
