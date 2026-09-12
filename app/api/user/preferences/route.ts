import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { getModel } from '@/lib/ai/models'
import { apiError, readJson, validationError } from '@/lib/utils/api'

const preferencesSchema = z.object({
  defaultModel: z.string().max(40).optional(),
  customInstructions: z.string().max(4000).nullable().optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  enterToSend: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError('Not signed in.', 401)

  const parsed = preferencesSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error)

  const { defaultModel, ...rest } = parsed.data
  const data = {
    ...rest,
    ...(defaultModel ? { defaultModel: getModel(defaultModel).id } : {}),
  }

  const preferences = await prisma.preferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  })

  return NextResponse.json({ preferences })
}
