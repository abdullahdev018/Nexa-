import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createSession, destroyAllSessions, getCurrentUser } from '@/lib/auth/session'
import { changePasswordSchema } from '@/lib/auth/validation'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { rateLimit } from '@/lib/utils/rate-limit'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  // A session alone must not be enough to guess the current password.
  const limit = rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000)
  if (!limit.ok) return apiError(`Too many attempts. Try again in ${limit.retryAfter}s.`, 429)

  const parsed = changePasswordSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: 'credentials', providerAccountId: user.email },
    },
    select: { id: true, passwordHash: true },
  })

  if (!account?.passwordHash) {
    return apiError('This account does not sign in with a password.', 400)
  }

  const valid = await verifyPassword(parsed.data.currentPassword, account.passwordHash)
  if (!valid) {
    return apiError('That password is not correct.', 401, {
      currentPassword: 'That password is not correct.',
    })
  }

  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  })

  // Every other device is signed out, then this one is given a fresh session —
  // a password change should end any session the old password could have
  // created.
  await destroyAllSessions(user.id)
  await createSession(user.id, {
    userAgent: request.headers.get('user-agent'),
    ip: null,
  })

  return NextResponse.json({ ok: true })
}
