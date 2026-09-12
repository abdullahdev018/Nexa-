import { NextResponse } from 'next/server'
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
      plan: true,
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

/** Deletes the account. Cascades remove sessions, conversations and messages. */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  await prisma.user.delete({ where: { id: user.id } })
  return NextResponse.json({ ok: true })
}
