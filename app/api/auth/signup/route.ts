import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { signupSchema } from '@/lib/auth/validation'
import { apiError, readJson, validationError } from '@/lib/utils/api'
import { clientIp, rateLimit } from '@/lib/utils/rate-limit'

export async function POST(request: Request) {
  const ip = clientIp(request)
  const limit = rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)
  if (!limit.ok) {
    return apiError('Too many accounts created from here. Try again later.', 429)
  }

  const body = await readJson(request)
  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error)

  const { name, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    // Saying so is the honest answer and the address is already discoverable
    // through the login form; hiding it here would only frustrate real users.
    return apiError('An account with that email already exists.', 409, {
      email: 'An account with that email already exists.',
    })
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      accounts: {
        create: { provider: 'credentials', providerAccountId: email, passwordHash },
      },
      preferences: { create: {} },
    },
    select: { id: true, email: true, name: true, onboardedAt: true },
  })

  await createSession(user.id, {
    userAgent: request.headers.get('user-agent'),
    ip: ip === 'unknown' ? null : ip,
  })

  // Straight into the product — nothing stands between signing up and
  // using it.
  return NextResponse.json({ user, next: '/chat' }, { status: 201 })
}
