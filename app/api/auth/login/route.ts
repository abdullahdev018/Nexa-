import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { DEFAULT_THEME, isTheme, THEME_COOKIE } from '@/lib/theme'
import { fakeVerify, verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { loginSchema } from '@/lib/auth/validation'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { clientIp, rateLimit } from '@/lib/utils/rate-limit'

export async function POST(request: Request) {
  const ip = clientIp(request)
  const parsedBody = await readJson<{ email?: string }>(request)

  // Limited per IP and per address: the first stops one host spraying many
  // accounts, the second stops a botnet hammering one account.
  const byIp = rateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000)
  const byEmail = rateLimit(`login:email:${String(parsedBody?.email ?? '').toLowerCase()}`, 10, 15 * 60 * 1000)
  if (!byIp.ok || !byEmail.ok) {
    return apiError('Too many sign-in attempts. Try again in a few minutes.', 429)
  }

  const parsed = loginSchema.safeParse(parsedBody)
  if (!parsed.success) return validationError(parsed.error)

  const { email, password } = parsed.data

  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: email } },
    select: {
      passwordHash: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          onboardedAt: true,
          preferences: { select: { theme: true } },
        },
      },
    },
  })

  if (!account?.passwordHash) {
    // Spend the same time as a real check so response timing does not reveal
    // whether the address is registered.
    await fakeVerify()
    return apiError('Email or password is incorrect.', 401)
  }

  const valid = await verifyPassword(password, account.passwordHash)
  if (!valid) return apiError('Email or password is incorrect.', 401)

  await createSession(account.user.id, {
    userAgent: request.headers.get('user-agent'),
    ip: ip === 'unknown' ? null : ip,
  })

  // Carry the stored theme onto this device, so the first page after sign-in
  // already renders in the theme the account chose rather than the default.
  const stored = account.user.preferences?.theme
  const store = await cookies()
  store.set(THEME_COOKIE, isTheme(stored) ? stored : DEFAULT_THEME, {
    path: '/',
    maxAge: 31_536_000,
    sameSite: 'lax',
  })

  // `preferences` was only fetched for the cookie above; it is not part of the
  // response shape the client expects.
  const user = {
    id: account.user.id,
    email: account.user.email,
    name: account.user.name,
    onboardedAt: account.user.onboardedAt,
  }

  return NextResponse.json({
    user,
    next: user.onboardedAt ? '/chat' : '/onboarding',
  })
}
