import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyPassword } from '@/lib/auth/password'
import { rateLimit } from '@/lib/utils/rate-limit'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { updateProfileSchema } from '@/lib/auth/validation'
import { apiError, readJson, validationError } from '@/lib/utils/api'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      useCases: true,
      createdAt: true,
      onboardedAt: true,
      preferences: true,
      _count: { select: { conversations: true } },
    },
  })

  return NextResponse.json({ user: full })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const parsed = updateProfileSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true },
  })

  return NextResponse.json({ user: updated })
}

const deleteSchema = z.object({ password: z.string().min(1, 'Enter your password to confirm.').max(200) })

/**
 * Deletes the account, and with it every workspace it owns and everything in
 * them (the schema cascades). Irreversible, so it asks for the password: a
 * session alone — a borrowed laptop, a stolen cookie — is not enough.
 */
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const limit = rateLimit(`delete-account:${user.id}`, 5, 15 * 60 * 1000)
  if (!limit.ok) return apiError(`Too many attempts. Try again in ${limit.retryAfter}s.`, 429)

  const parsed = deleteSchema.safeParse((await readJson(request)) ?? {})
  if (!parsed.success) return validationError(parsed.error)

  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'credentials', providerAccountId: user.email } },
    select: { passwordHash: true },
  })
  if (!account?.passwordHash || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
    return apiError('That password is not correct.', 401, { password: 'That password is not correct.' })
  }

  await prisma.user.delete({ where: { id: user.id } })
  return NextResponse.json({ ok: true })
}
