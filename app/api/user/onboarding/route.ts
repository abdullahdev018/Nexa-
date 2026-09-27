import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { onboardingSchema } from '@/lib/auth/validation'
import { getModel } from '@/lib/ai/models'
import { apiError, readJson, validationError } from '@/lib/utils/api'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const parsed = onboardingSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  // Resolve through the registry so an unknown id from a stale client falls
  // back to the default rather than being stored.
  const model = getModel(parsed.data.defaultModel)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: parsed.data.role,
      useCases: parsed.data.useCases,
      onboardedAt: new Date(),
      preferences: {
        upsert: {
          create: { defaultModel: model.id },
          update: { defaultModel: model.id },
        },
      },
    },
  })

  return NextResponse.json({ ok: true, next: '/dashboard' })
}
