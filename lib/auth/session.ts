import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { prisma } from '@/lib/db/prisma'

export const SESSION_COOKIE = 'nexa_session'

/** Thirty days, refreshed whenever the session is used inside the last week. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The cookie carries a random token; the database stores only its SHA-256.
 * Anyone reading the sessions table therefore cannot mint a working cookie.
 * SHA-256 is right here (rather than bcrypt) because the input is already 256
 * bits of entropy — there is nothing to brute-force.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface SessionUser {
  id: string
  email: string
  name: string | null
  image: string | null
  /** Which workspace to open. Resolved into a real one by lib/auth/workspace. */
  lastWorkspaceId: string | null
  onboardedAt: Date | null
}

/** Issues a session and sets the cookie. Returns the raw token for tests. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      ip: meta.ip ?? null,
    },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return token
}

/**
 * Resolves the signed-in user, or null. Wrapped in `cache` so several server
 * components in one render share a single database round trip.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastUsedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          lastWorkspaceId: true,
          onboardedAt: true,
        },
      },
    },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired rows are cleared on use rather than by a scheduled job, which
    // keeps the deployment to one moving part.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  // Sliding expiry, but only written once a week so a busy session does not
  // issue an UPDATE on every request.
  if (Date.now() - session.lastUsedAt.getTime() > REFRESH_AFTER_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {})
  }

  return session.user
})

/** Deletes the current session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE)
}

/** Invalidates every session for a user — used when the password changes. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
}

/** Constant-time string compare for CSRF tokens and similar short secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
